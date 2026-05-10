module 0x0::inventory {
    use std::string::String;
    use sui::clock::Clock;
    use sui::coin::{Self, Coin};
    use sui::event;
    use std::option::{Self, Option};
    use sui::object::{Self, UID};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    const EItemBroken: u64 = 1;
    const EInvalidPrice: u64 = 2;
    const EListingInactive: u64 = 3;
    const EInsufficientPayment: u64 = 4;
    const EUnauthorized: u64 = 5;
    const EInvalidRarity: u64 = 6;

    public enum Rarity has copy, drop, store {
        Common,
        Rare,
        Epic,
        Legendary,
    }

    public struct Item has key, store {
        id: UID,
        name: String,
        item_type: String,
        rarity: Rarity,
        level: u64,
        durability: u64,
        max_durability: u64,
        created_at: u64,
    }

    public struct ItemMinted has copy, drop {
        item_id: address,
        owner: address,
        rarity: Rarity,
        durability: u64,
        max_durability: u64,
    }

    public struct ItemUsed has copy, drop {
        item_id: address,
        owner: address,
        durability_after: u64,
    }

    public struct ItemUpgraded has copy, drop {
        item_id: address,
        owner: address,
        level_after: u64,
        max_durability_after: u64,
    }

    public struct Inventory has key, store {
        id: UID,
        owner: address,
        total_farms: u64,
        created_at: u64,
        last_farm_at: u64,
    }

    public struct InventoryCreated has copy, drop {
        inventory_id: address,
        owner: address,
    }

    public struct LootRolled has copy, drop {
        owner: address,
        roll: u64,
        rarity: Rarity,
    }

    public struct Listing has key, store {
        id: UID,
        seller: address,
        price: u64,
        item: Option<Item>,
        active: bool,
        created_at: u64,
    }

    public struct ItemListed has copy, drop {
        listing_id: address,
        seller: address,
        item_id: address,
        price: u64,
    }

    public struct ItemBought has copy, drop {
        listing_id: address,
        seller: address,
        buyer: address,
        item_id: address,
        price: u64,
    }

    public struct ListingCancelled has copy, drop {
        listing_id: address,
        seller: address,
        item_id: address,
    }

    public entry fun create_inventory(clock: &Clock, ctx: &mut TxContext) {
        let owner = tx_context::sender(ctx);
        let inventory = Inventory {
            id: object::new(ctx),
            owner,
            total_farms: 0,
            created_at: clock.timestamp_ms(),
            last_farm_at: 0,
        };

        event::emit(InventoryCreated {
            inventory_id: object::uid_to_address(&inventory.id),
            owner,
        });

        transfer::public_transfer(inventory, owner);
    }

    public entry fun mint_item(
        name: String,
        item_type: String,
        rarity: u8,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let owner = tx_context::sender(ctx);
        let parsed_rarity = rarity_from_u8(rarity);

        let item = Item {
            id: object::new(ctx),
            name,
            item_type,
            rarity: parsed_rarity,
            level: 1,
            durability: 10,
            max_durability: 10,
            created_at: clock.timestamp_ms(),
        };

        let item_id = object::uid_to_address(&item.id);
        event::emit(ItemMinted {
            item_id,
            owner,
            rarity: item.rarity,
            durability: item.durability,
            max_durability: item.max_durability,
        });

        transfer::public_transfer(item, owner);
    }

    public entry fun farm_random_item(
        inventory: &mut Inventory,
        name: String,
        item_type: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let owner = tx_context::sender(ctx);
        assert!(owner == inventory.owner, EUnauthorized);
        inventory.total_farms = inventory.total_farms + 1;
        inventory.last_farm_at = clock.timestamp_ms();
        let roll = (clock.timestamp_ms() + tx_context::epoch(ctx)) % 100;
        let rarity = roll_to_rarity(roll);

        event::emit(LootRolled { owner, roll, rarity });
        mint_item(name, item_type, rarity_to_u8(rarity), clock, ctx);
    }

    public entry fun use_item(item: &mut Item, ctx: &TxContext) {
        assert!(item.durability > 0, EItemBroken);
        item.durability = item.durability - 1;

        event::emit(ItemUsed {
            item_id: object::uid_to_address(&item.id),
            owner: tx_context::sender(ctx),
            durability_after: item.durability,
        });
    }

    public entry fun upgrade_item(item: &mut Item, ctx: &TxContext) {
        item.level = item.level + 1;
        item.max_durability = item.max_durability + 5;
        item.durability = item.max_durability;

        event::emit(ItemUpgraded {
            item_id: object::uid_to_address(&item.id),
            owner: tx_context::sender(ctx),
            level_after: item.level,
            max_durability_after: item.max_durability,
        });
    }

    public entry fun list_item(item: Item, price: u64, clock: &Clock, ctx: &mut TxContext) {
        assert!(price > 0, EInvalidPrice);

        let seller = tx_context::sender(ctx);
        let item_id = object::uid_to_address(&item.id);
        let listing = Listing {
            id: object::new(ctx),
            seller,
            price,
            item: option::some(item),
            active: true,
            created_at: clock.timestamp_ms(),
        };

        let listing_id = object::uid_to_address(&listing.id);
        event::emit(ItemListed {
            listing_id,
            seller,
            item_id,
            price,
        });

        transfer::public_transfer(listing, seller);
    }

    public entry fun buy_item(listing: &mut Listing, mut payment: Coin<SUI>, ctx: &mut TxContext) {
        assert!(listing.active, EListingInactive);
        let buyer = tx_context::sender(ctx);
        let paid = coin::value(&payment);
        assert!(paid >= listing.price, EInsufficientPayment);

        let seller_payment = coin::split(&mut payment, listing.price, ctx);
        transfer::public_transfer(seller_payment, listing.seller);
        if (coin::value(&payment) > 0) {
            transfer::public_transfer(payment, buyer);
        } else {
            coin::destroy_zero(payment);
        };

        let item = option::extract(&mut listing.item);
        let item_id = object::uid_to_address(&item.id);
        transfer::public_transfer(item, buyer);
        listing.active = false;

        event::emit(ItemBought {
            listing_id: object::uid_to_address(&listing.id),
            seller: listing.seller,
            buyer,
            item_id,
            price: listing.price,
        });
    }

    public entry fun cancel_listing(listing: &mut Listing, ctx: &TxContext) {
        assert!(listing.active, EListingInactive);
        let sender = tx_context::sender(ctx);
        assert!(sender == listing.seller, EUnauthorized);

        let item = option::extract(&mut listing.item);
        let item_id = object::uid_to_address(&item.id);
        transfer::public_transfer(item, sender);
        listing.active = false;

        event::emit(ListingCancelled {
            listing_id: object::uid_to_address(&listing.id),
            seller: sender,
            item_id,
        });
    }

    fun roll_to_rarity(roll: u64): Rarity {
        if (roll < 60) {
            Rarity::Common
        } else if (roll < 85) {
            Rarity::Rare
        } else if (roll < 97) {
            Rarity::Epic
        } else {
            Rarity::Legendary
        }
    }

    fun rarity_from_u8(value: u8): Rarity {
        if (value == 0) {
            Rarity::Common
        } else if (value == 1) {
            Rarity::Rare
        } else if (value == 2) {
            Rarity::Epic
        } else if (value == 3) {
            Rarity::Legendary
        } else {
            abort EInvalidRarity
        }
    }

    fun rarity_to_u8(rarity: Rarity): u8 {
        if (rarity == Rarity::Common) {
            0
        } else if (rarity == Rarity::Rare) {
            1
        } else if (rarity == Rarity::Epic) {
            2
        } else {
            3
        }
    }
}
