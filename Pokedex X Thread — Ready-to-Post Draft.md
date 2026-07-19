# Pokedex X Thread — Ready-to-Post Draft

> **Posting note:** Publish the posts in sequence as a thread. The bold `1/15` labels are editorial markers and do not need to be copied into X. The links below were verified on July 19, 2026. Keep the source-boundary language intact so the post does not imply a complete collection valuation or an investment product.

## Thread

**1/15**

What is Pokedex?

Pokedex is a transparent way to follow a defined Pokémon TCG price basket—starting with the original Base Set holofoils.

It is built to show the inputs, the coverage, and the boundaries instead of hiding them behind a single number.

https://pokedexmarkets.xyz

**2/15**

The important distinction: Pokedex is **not** pricing every card in the full 102-card Base Set.

The live market is a curated basket of the 16 original Base Set holofoil rares. It is a focused, inspectable reference basket—not a complete collection valuation.

**3/15**

Why only 16 cards?

They are the iconic Base Set holofoils: Alakazam, Blastoise, Charizard, Chansey, Clefairy, Gyarados, Hitmonchan, Machamp, Magneton, Mewtwo, Nidoking, Ninetales, Poliwrath, Raichu, Venusaur, and Zapdos.

**4/15**

Each holofoil has the same normalized weight: **6.25%**.

That is simply 1 ÷ 16.

Equal weighting means the system does not give Charizard an extra multiplier just because it is expensive. A $1 move in any included card has the same mathematical effect on the normalized basket.

**5/15**

That does **not** mean every card contributes the same number of dollars.

Charizard can make up a much larger share of the live USD subtotal because its market price is higher. The 6.25% number describes the basket rule; the subtotal shows the observed card prices.

**6/15**

For live observations, Pokedex reads the TCGplayer USD **holofoil market-price** field through TCGdex for each configured component.

The provider’s update time and local retrieval time are preserved for auditability.

https://tcgdex.dev/markets-prices

**7/15**

Coverage is never hidden.

If a component does not have a compatible current provider price, Pokedex shows the live number as a **priced-card subtotal** with its coverage—for example, “15/16 cards priced”—rather than pretending it is a full-set total.

**8/15**

So the headline number is not a prediction, an appraisal, or an investable price.

It is a transparent USD subtotal of the currently priced components in a defined 16-card holofoil basket. The normalized calculation remains available only as an audit record.

**9/15**

The chart uses one view, but it does not blur different data sources together.

The earlier amber segment is a clearly labelled public TCGdex price-history proxy: 15 available **holo-good** components through September 2024.

https://github.com/tcgdex/price-history

**10/15**

The newer cyan segment is the current live TCGdex / TCGplayer USD subtotal for the configured holofoil basket.

The archive and live series are source- and coverage-labelled. They are not treated as one uninterrupted, directly comparable feed.

**11/15**

You will see a dashed visual connector between the archive and live segments.

That connector is a guide to make the timeline readable—not a market-price observation, not interpolation, and not an invented intermediary value.

**12/15**

Pokedex is also a testnet systems proof.

The project records source-backed price reads, shows the component methodology, and tests a user-controlled wallet contribution flow before any mainnet decision or broader rollout.

**13/15**

The safety boundary is intentional:

• Users initiate transactions in their own wallets.
• Pokedex does not ask for private keys or recovery phrases.
• Testnet activity is not a mainnet offering, investment product, or promise of value.

**14/15**

Want the full methodology, data boundaries, wallet flow, and source disclosures?

Read the Whitepaper:
https://pokedexmarkets.xyz/whitepaper

Follow the public build here:
https://github.com/BrockXTPL?tab=repositories

**15/15**

The goal is simple: make collectible-card market data more inspectable.

Start with an iconic basket. Show the exact scope. Label coverage gaps. Keep historical and live sources honest. Build in public.

Explore Pokedex:
https://pokedexmarkets.xyz

---

## Source Links Used in the Thread

| Purpose | Link |
|---|---|
| Live Pokedex market | https://pokedexmarkets.xyz |
| Pokedex Whitepaper | https://pokedexmarkets.xyz/whitepaper |
| Current market-data documentation | https://tcgdex.dev/markets-prices |
| Historical archive | https://github.com/tcgdex/price-history |
| Public project repositories | https://github.com/BrockXTPL?tab=repositories |

## Optional First-Post Variants

**More direct:**

> Pokémon cards have prices everywhere. Transparent methodology is rarer. Pokedex starts with a defined Base Set holofoil basket and shows exactly what the number includes—and what it does not.

**More collector-led:**

> The original Base Set holofoils are iconic. Pokedex is an attempt to track them with a price system that shows its work: components, coverage, sources, and history.

**More product-led:**

> Introducing Pokedex: a transparent Pokémon TCG market-data project, beginning with a 16-card Base Set holofoil basket and a clearly labelled USD price history.
