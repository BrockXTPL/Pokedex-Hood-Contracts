# MetaMask Wallet and Robinhood Chain Testnet Walkthrough

> **Security rule:** Your Secret Recovery Phrase, private key, and MetaMask password must remain private. Do not paste them into this site, chat, email, a form, or any support request. No legitimate deployment workflow needs them.

This walkthrough creates a **fresh wallet that you control** and connects it to **Robinhood Chain Testnet** for the Base Set validation flow. It does not deploy, fund, or approve any transaction for you. You will personally review and approve every wallet prompt.

## 1. Install MetaMask from the official source

Open the official [MetaMask website][1] in the browser where you plan to use Pokemon Index Markets. Select **Get MetaMask**, install the browser extension through the browser’s official extension store, and pin the extension so it is easy to open. MetaMask’s official setup documentation explains that the extension is a self-custodial wallet client: the wallet owner controls the keys and funds.[1]

Avoid extension-store advertisements, look-alike domains, direct messages, and anyone offering to create or “secure” the wallet for you. If a browser already has multiple wallet extensions, disable any conflicting default wallet before continuing so you can clearly identify MetaMask prompts.[1]

## 2. Create a fresh wallet

Open the MetaMask extension and choose **Create a new wallet**. Follow the on-screen prompts to create a local password for that browser profile, then reveal the **Secret Recovery Phrase** only when you are in a private location.

Write the phrase down offline, in the order shown. Do not store it in a screenshot, cloud note, shared document, email, or password manager that others can access. Complete MetaMask’s confirmation step by selecting the words in order. The phrase is the backup for the wallet; anyone who has it can control the wallet.

| Item | What to do | What not to do |
| --- | --- | --- |
| MetaMask password | Create a strong local password and keep it private. | Do not reuse a password you share with others. |
| Secret Recovery Phrase | Store it offline and verify it once. | Do not share it with anyone, including this project or support staff. |
| Public wallet address | Copy it only when you need to receive testnet ETH or configure a deployment. | Do not confuse it with the Secret Recovery Phrase. |

## 3. Add Robinhood Chain Testnet

In the MetaMask extension, open the network selector. If **Robinhood Chain** is listed under additional networks, choose **Add**. Otherwise, use **Networks** and then **Add a custom network**, as described in MetaMask’s network guide.[2]

Enter the official Robinhood Chain Testnet details below, then save. Robinhood documents this testnet configuration for browser wallets such as MetaMask.[3] [4]

| Field | Value |
| --- | --- |
| Network name | Robinhood Chain Testnet |
| Chain ID | `46630` |
| Currency symbol | `ETH` |
| RPC URL | `https://rpc.testnet.chain.robinhood.com` |
| Block explorer | `https://explorer.testnet.chain.robinhood.com` |

After saving, select **Robinhood Chain Testnet** from the network selector. Confirm that the extension shows **Testnet** and the chain ID is **46630** before you connect it to the platform.

## 4. Receive testnet ETH safely

Copy the **public account address** displayed in MetaMask. It starts with `0x` and can be safely shared when you need testnet ETH. It is not a password and does not grant control of the wallet.

Use only a trustworthy testnet funding source or transfer test ETH from another wallet you control. Verify the receiving network is **Robinhood Chain Testnet** before acting. After funds arrive, view the balance and any transaction hash in the official testnet explorer: <https://explorer.testnet.chain.robinhood.com>.[3]

## 5. Connect the fresh wallet to Pokemon Index Markets

Open the published Pokemon Index Markets site and select **Fund testnet**. Choose **MetaMask** or **WalletConnect**, then select the fresh wallet account in the wallet prompt. MetaMask will ask you to approve a connection; this connection only lets the site read the selected public address and request a transaction for your review.

If MetaMask asks to switch networks, verify it is switching to **Robinhood Chain Testnet (46630)** before approving. Decline any wallet prompt that names a different network, an unknown contract, or an amount you do not understand.

## 6. Configure the Base Set testnet pool only after deployment

The owner Control room has a **Base Set testnet contract descriptor** field. After you deploy the prepared `BaseSetTestnetLiquidityPool.sol` contract from your own wallet, copy the resulting public contract address from the wallet confirmation or the testnet explorer. Paste only that public address into the Control room.

Do not paste the Secret Recovery Phrase, private key, MetaMask password, or a seed phrase into the Control room. The public contract address is sufficient for the platform to display the testnet pool configuration and reconcile user-approved contribution receipts.

## 7. Perform the final test contribution yourself

Once the testnet contract address is configured, return to **Fund testnet**, enter a very small test amount, and review the transaction in MetaMask. Confirm all of the following before you approve it:

| Check | Expected testnet value |
| --- | --- |
| Network | Robinhood Chain Testnet, chain ID `46630` |
| Destination | The Base Set testnet pool address you configured |
| Asset | Testnet ETH |
| Amount | A small amount you intentionally chose |
| Purpose | Base Set testnet liquidity validation only |

After MetaMask reports success, wait for the transaction to appear in the testnet explorer and for the funding card in Pokemon Index Markets to refresh. The platform’s in-page polling and server-side receipt reconciliation should then show the updated contribution without a full page refresh.

## 8. What to send back here

Once you finish wallet creation and network setup, send only the following status—not any secret:

> “Fresh MetaMask wallet is on Robinhood Chain Testnet. I am ready for the Base Set contract deployment steps.”

I can then guide you through reading the prepared deployment handoff and using your own wallet to approve the testnet deployment.

## References

[1]: https://support.metamask.io/start/getting-started-with-metamask/ "MetaMask: How to install MetaMask"
[2]: https://support.metamask.io/configure/networks/how-to-add-a-custom-network-rpc/ "MetaMask: How to add a network"
[3]: https://docs.robinhood.com/chain/add-network-to-wallet/ "Robinhood Chain: Add network to your wallet"
[4]: https://docs.robinhood.com/chain/connecting/ "Robinhood Chain: Connecting to Robinhood Chain"
