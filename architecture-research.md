# Architecture Research Notes

## Verified Robinhood Chain Testnet Configuration

Robinhood Chain is documented as an EVM-compatible Arbitrum Layer-2 chain. The Base Set proof-of-concept should target **Robinhood Chain Testnet** with chain ID **46630**, ETH as the native currency, the public testnet RPC endpoint `https://rpc.testnet.chain.robinhood.com`, and the official testnet explorer at `https://explorer.testnet.chain.robinhood.com`. Robinhood documents public RPC endpoints as rate-limited and recommends provider-backed infrastructure for production-quality use; this project will keep the testnet configuration server-side and make the endpoint configurable.[1]

The application should call `wallet_addEthereumChain` / `wallet_switchEthereumChain` only from a user-initiated wallet action. It will never request or store private keys, and it will not initiate a contribution without the user reviewing and approving the transaction in their own wallet.

## Price-Data Decision

TCGdex documents embedded card-market data sourced from Cardmarket and TCGplayer. It reports variant-specific pricing and current market values, with short-term provider trends; its published examples include TCGplayer normal, reverse, and holo fields and Cardmarket average, low, trend, 1-day, 7-day, and 30-day values.[2]

For the Base Set market, the server will preserve every raw provider observation and construct a transparent series from recorded snapshots. The UI must describe the chart accurately as **provider trend where available plus Pokedex-recorded index history from the first successful sync onward**. It must not fabricate an all-time price series or present short-term fields as a complete historical record.

PriceCharting documents that its API and CSV support current values only and do not support historic prices or historic sales. It is therefore unsuitable as the sole source for the requested historical chart, though it could be introduced later as a separately labeled current-price cross-check if licensing and access terms permit.[3]

## Initial Technical Shape

The Base Set testnet market will use a server-controlled configuration record for chain details, contract addresses, ABI metadata, launch threshold, and market lifecycle. The frontend will request only an approved public contract descriptor through authenticated server procedures; contract deployment keys, signing keys, and administrative secrets will remain server-side and are out of scope for the frontend.

The recurring oracle job will be deterministic: fetch provider data, validate variants and freshness, calculate the Base Set index from a versioned component set and weighting model, persist a snapshot, and update on-chain only when a configured authorized signer and deployed testnet oracle are available. Until real testnet contract deployment details are provided, the app will expose a clear **configuration pending** state rather than inventing addresses, ABIs, balances, or transactions.

## References

[1]: https://docs.robinhood.com/chain/connecting/ "Connecting to Robinhood Chain"
[2]: https://tcgdex.dev/markets-prices "Pokémon TCG Markets Integration"
[3]: https://www.pricecharting.com/api-documentation "PriceCharting API Documentation"

## Verified Base Set Component and Variant Details

The public TCGdex set endpoint identifies the English Original Base Set as `base1` and reports 102 official cards. A live response for `base1-4` identifies Charizard as a Base Set rare with multiple variants and exposes the North American `tcgplayer.holofoil.marketPrice` field alongside the provider update timestamp. The first version of the Base Set index will use an explicitly selected, documented variant per component—starting with **unlimited holofoil** where the data is present—rather than mixing first-edition, shadowless, promotional, normal, or other variants. Components without the approved variant or a fresh source timestamp will be excluded and the coverage status will be reported.[4]

[4]: https://api.tcgdex.net/v2/en/cards/base1-4 "TCGdex Base Set Charizard response"

## Owner-Controlled Wallet and Testnet Connection References

MetaMask’s official setup guide confirms that a user installs the browser extension from the official site and creates their own wallet locally; the user retains control of the wallet’s private keys and funds. MetaMask’s network guide explains that custom EVM networks are added through the Networks menu and the “Add a custom network” flow.

Robinhood’s official Chain documentation specifies the Robinhood Chain Testnet values required for manual wallet configuration: Chain ID `46630`; RPC URL `https://rpc.testnet.chain.robinhood.com`; native currency symbol `ETH`; block explorer `https://explorer.testnet.chain.robinhood.com`.

Sources:
- https://support.metamask.io/start/getting-started-with-metamask/
- https://support.metamask.io/configure/networks/how-to-add-a-custom-network-rpc/
- https://docs.robinhood.com/chain/add-network-to-wallet/
- https://docs.robinhood.com/chain/connecting/
