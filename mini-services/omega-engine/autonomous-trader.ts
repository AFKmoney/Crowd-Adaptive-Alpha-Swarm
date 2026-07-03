// OMEGA Engine — Multi-Chain Wallet Scanner + Autonomous Trader
//
// When a wallet connects, this module:
// 1. Scans ALL 7 chains for ALL tokens (ETH, USDT, USDC, WBTC, MATIC, BNB, AVAX, etc.)
// 2. Detects every asset the wallet holds across all chains
// 3. Combines with the bot's market signals to decide WHICH asset to trade
// 4. Executes the trade autonomously on the right chain

import { ethers, JsonRpcProvider, Contract, Wallet } from 'ethers'

const CHAINS: Record<number, { name: string; rpc: string; router: string; weth: string; nativeSymbol: string }> = {
  1:     { name: 'Ethereum',  rpc: 'https://ethereum-rpc.publicnode.com',          router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', nativeSymbol: 'ETH' },
  137:   { name: 'Polygon',   rpc: 'https://polygon-bor-rpc.publicnode.com',       router: '0xa5E0829CaCED8fFDD4De3c43696c57F7D7A678ff', weth: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', nativeSymbol: 'MATIC' },
  42161: { name: 'Arbitrum',  rpc: 'https://arbitrum-one-rpc.publicnode.com',      router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', nativeSymbol: 'ETH' },
  10:    { name: 'Optimism',  rpc: 'https://optimism-rpc.publicnode.com',          router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', weth: '0x4200000000000000000000000000000000000006', nativeSymbol: 'ETH' },
  56:    { name: 'BSC',        rpc: 'https://bsc-rpc.publicnode.com',               router: '0x10ED43C718714eb63d5aA57B78B54704E256024E', weth: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', nativeSymbol: 'BNB' },
  43114: { name: 'Avalanche', rpc: 'https://avalanche-c-chain-rpc.publicnode.com', router: '0x60aE616a2155Ee3d9A68541Ba4544862310933d4', weth: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', nativeSymbol: 'AVAX' },
  8453:  { name: 'Base',      rpc: 'https://base-rpc.publicnode.com',              router: '0x8cFe327CEc66d1c090Dd72bd0FF11d690C33a2Eb', weth: '0x4200000000000000000000000000000000000006', nativeSymbol: 'ETH' },
}

// Common tokens to scan for on each chain
const TOKEN_REGISTRY: Record<string, Record<number, { address: string; decimals: number; coingeckoId: string }>> = {
  'USDT':  { 1: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, coingeckoId: 'tether' }, 137: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, coingeckoId: 'tether' }, 56: { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, coingeckoId: 'tether' }, 42161: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6, coingeckoId: 'tether' }, 10: { address: '0x94b008aA00579c1307B0EF2c499aD98a8ceB58e1', decimals: 6, coingeckoId: 'tether' }, 43114: { address: '0x9702230A8Ea53601f5cD2dc00fDBc4d4CdC76D18', decimals: 6, coingeckoId: 'tether' } },
  'USDC':  { 1: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, coingeckoId: 'usd-coin' }, 137: { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6, coingeckoId: 'usd-coin' }, 56: { address: '0x8AC76A51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, coingeckoId: 'usd-coin' }, 42161: { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', decimals: 6, coingeckoId: 'usd-coin' }, 10: { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6, coingeckoId: 'usd-coin' } },
  'WBTC':  { 1: { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8, coingeckoId: 'wrapped-bitcoin' } },
  'LINK':  { 1: { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18, coingeckoId: 'chainlink' }, 137: { address: '0x53E0b8883565bdDE9D6F8B963A9D22F7f8E8E9E5', decimals: 18, coingeckoId: 'chainlink' } },
  'UNI':   { 1: { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18, coingeckoId: 'uniswap' } },
  'AAVE':  { 1: { address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', decimals: 18, coingeckoId: 'aave' } },
  'DAI':   { 1: { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18, coingeckoId: 'dai' }, 137: { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals: 18, coingeckoId: 'dai' } },
  'SHIB':  { 1: { address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', decimals: 18, coingeckoId: 'shiba-inu' } },
  'PEPE':  { 1: { address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', decimals: 18, coingeckoId: 'pepe' } },
}

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
]

export interface WalletAsset {
  chainId: number
  chainName: string
  symbol: string
  address: string          // token contract address (or 'native' for ETH/MATIC/etc)
  balance: number          // human-readable balance
  balanceUsd: number       // estimated USD value
  decimals: number
  isNative: boolean
  tradable: boolean        // can be traded on Uniswap
}

export interface AutonomousDecision {
  action: 'swap' | 'hold' | 'bridge'
  fromAsset: WalletAsset | null
  toToken: string          // symbol to swap into
  toChainId: number
  amount: number           // how much to swap
  reason: string           // why this decision
  confidence: number       // 0..1
  expectedGain: number     // estimated %
}

export interface AutonomousTraderState {
  scanning: boolean
  totalAssets: number
  totalValueUsd: number
  assets: WalletAsset[]
  chainsWithAssets: number[]
  decision: AutonomousDecision | null
  autoTradeEnabled: boolean
  tradesExecuted: number
  lastScan: number
}

export class AutonomousTrader {
  private wallet: Wallet | null = null
  private scanning = false
  private assets: WalletAsset[] = []
  private autoTradeEnabled = false
  private tradesExecuted = 0
  private lastScan = 0
  private lastDecision: AutonomousDecision | null = null
  private scanInterval: ReturnType<typeof setInterval> | null = null

  setWallet(wallet: Wallet): void {
    this.wallet = wallet
    // Start scanning immediately + every 30s
    this.scanAllChains()
    if (this.scanInterval) clearInterval(this.scanInterval)
    this.scanInterval = setInterval(() => this.scanAllChains(), 30_000)
  }

  setAutoTrade(enabled: boolean): void {
    this.autoTradeEnabled = enabled
  }

  /** Scan ALL 7 chains for ALL tokens in the wallet */
  async scanAllChains(): Promise<void> {
    if (!this.wallet || this.scanning) return
    this.scanning = true
    this.lastScan = Date.now()
    const foundAssets: WalletAsset[] = []

    // Scan each chain in parallel
    const scanPromises = Object.entries(CHAINS).map(async ([chainIdStr, chain]) => {
      const chainId = parseInt(chainIdStr)
      const assets: WalletAsset[] = []
      try {
        const provider = new JsonRpcProvider(chain.rpc)
        const address = this.wallet!.address

        // 1. Check native balance (ETH/MATIC/BNB/AVAX)
        const nativeBal = await provider.getBalance(address)
        const nativeNum = parseFloat(ethers.formatEther(nativeBal))
        if (nativeNum > 0.0001) {
          assets.push({
            chainId, chainName: chain.name,
            symbol: chain.nativeSymbol, address: 'native',
            balance: nativeNum, balanceUsd: nativeNum * 3000, // rough
            decimals: 18, isNative: true, tradable: true,
          })
        }

        // 2. Scan all registered tokens on this chain
        for (const [symbol, chains] of Object.entries(TOKEN_REGISTRY)) {
          const tokenInfo = chains[chainId]
          if (!tokenInfo) continue
          try {
            const contract = new Contract(tokenInfo.address, ERC20_ABI, provider)
            const bal = await contract.balanceOf(address)
            const balance = parseFloat(ethers.formatUnits(bal, tokenInfo.decimals))
            if (balance > 0) {
              assets.push({
                chainId, chainName: chain.name,
                symbol, address: tokenInfo.address,
                balance, balanceUsd: balance * 1, // rough — would need price feed
                decimals: tokenInfo.decimals, isNative: false, tradable: true,
              })
            }
          } catch { /* skip */ }
        }
      } catch { /* chain RPC failed — skip */ }
      return assets
    })

    const results = await Promise.all(scanPromises)
    for (const chainAssets of results) {
      foundAssets.push(...chainAssets)
    }

    this.assets = foundAssets.sort((a, b) => b.balanceUsd - a.balanceUsd)
    this.scanning = false
    console.log(`[autonomous-trader] Scanned 7 chains — found ${this.assets.length} assets across ${new Set(this.assets.map(a => a.chainId)).size} chains`)
  }

  /** Make an autonomous trading decision based on wallet assets + market signals */
  makeDecision(
    consensus: { side: 'BUY' | 'SELL' | 'FLAT'; confidence: number },
    marketPrice: number,
    llmSentiment: number,
  ): AutonomousDecision {
    if (this.assets.length === 0) {
      return { action: 'hold', fromAsset: null, toToken: '', toChainId: 1, amount: 0, reason: 'No assets in wallet', confidence: 0, expectedGain: 0 }
    }

    const totalUsd = this.assets.reduce((a, ast) => a + ast.balanceUsd, 0)
    const largestAsset = this.assets[0] // highest USD value

    // Decision logic:
    // - If consensus is BUY and we have stablecoins → swap stablecoins for ETH
    // - If consensus is SELL and we have ETH/tokens → swap tokens for stablecoins
    // - If LLM sentiment is very bullish → accumulate ETH
    // - If LLM sentiment is very bearish → move to stablecoins
    // - If we have assets on multiple chains → consider bridging

    if (consensus.side === 'BUY' && consensus.confidence > 0.7) {
      // Look for stablecoins to swap into ETH
      const stables = this.assets.find(a => ['USDT', 'USDC', 'DAI'].includes(a.symbol))
      if (stables && stables.balance > 1) {
        const amount = Math.min(stables.balance, stables.balance * 0.5) // use 50% of stables
        return {
          action: 'swap',
          fromAsset: stables,
          toToken: stables.chainName === 'Ethereum' ? 'ETH' : 'ETH',
          toChainId: stables.chainId,
          amount,
          reason: `Bot signal BUY @ ${(consensus.confidence * 100).toFixed(0)}% — swapping ${amount.toFixed(2)} ${stables.symbol} → ETH on ${stables.chainName}`,
          confidence: consensus.confidence,
          expectedGain: consensus.confidence * 5, // rough expected gain %
        }
      }
    }

    if (consensus.side === 'SELL' && consensus.confidence > 0.7) {
      // Look for ETH/tokens to swap into stablecoins
      const ethAsset = this.assets.find(a => a.isNative || a.symbol === 'ETH')
      if (ethAsset && ethAsset.balance > 0.001) {
        const amount = Math.min(ethAsset.balance, ethAsset.balance * 0.3) // sell 30%
        return {
          action: 'swap',
          fromAsset: ethAsset,
          toToken: 'USDT',
          toChainId: ethAsset.chainId,
          amount,
          reason: `Bot signal SELL @ ${(consensus.confidence * 100).toFixed(0)}% — swapping ${amount.toFixed(4)} ETH → USDT on ${ethAsset.chainName}`,
          confidence: consensus.confidence,
          expectedGain: consensus.confidence * 3,
        }
      }
    }

    if (llmSentiment > 0.5 && largestAsset && ['USDT', 'USDC', 'DAI'].includes(largestAsset.symbol)) {
      return {
        action: 'swap',
        fromAsset: largestAsset,
        toToken: 'ETH',
        toChainId: largestAsset.chainId,
        amount: largestAsset.balance * 0.3,
        reason: `LLM sentiment bullish (${llmSentiment.toFixed(2)}) — accumulating ETH with 30% of ${largestAsset.symbol}`,
        confidence: Math.min(0.8, llmSentiment),
        expectedGain: llmSentiment * 4,
      }
    }

    if (llmSentiment < -0.5) {
      const ethAsset = this.assets.find(a => a.isNative || a.symbol === 'ETH')
      if (ethAsset && ethAsset.balance > 0.001) {
        return {
          action: 'swap',
          fromAsset: ethAsset,
          toToken: 'USDT',
          toChainId: ethAsset.chainId,
          amount: ethAsset.balance * 0.3,
          reason: `LLM sentiment bearish (${llmSentiment.toFixed(2)}) — moving 30% ETH → USDT for safety`,
          confidence: Math.min(0.8, Math.abs(llmSentiment)),
          expectedGain: Math.abs(llmSentiment) * 2,
        }
      }
    }

    return {
      action: 'hold',
      fromAsset: null,
      toToken: '',
      toChainId: 1,
      amount: 0,
      reason: `Holding — no strong signal (consensus: ${consensus.side} @ ${(consensus.confidence * 100).toFixed(0)}%, LLM: ${llmSentiment.toFixed(2)})`,
      confidence: 0,
      expectedGain: 0,
    }
  }

  /** Execute the autonomous decision */
  async executeDecision(
    web3Wallet: { executeTrade: (from: string, to: string, amount: number, slippage?: number) => Promise<any> },
    switchChain: (chainId: number) => Promise<void>,
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.lastDecision || this.lastDecision.action !== 'swap' || !this.lastDecision.fromAsset) {
      return { success: false, error: 'No swap decision to execute' }
    }

    const dec = this.lastDecision
    try {
      // Switch to the right chain if needed
      await switchChain(dec.toChainId)

      // Execute the trade via the web3 wallet adapter
      const result = await web3Wallet.executeTrade(
        dec.fromAsset.symbol,
        dec.toToken,
        dec.amount,
        200, // 2% slippage for safety
      )

      if (result?.success) {
        this.tradesExecuted++
        return { success: true, txHash: result.txHash }
      }
      return { success: false, error: result?.error || 'Trade failed' }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }

  state(): AutonomousTraderState {
    const chainsWithAssets = [...new Set(this.assets.map(a => a.chainId))]
    const totalValueUsd = this.assets.reduce((a, ast) => a + ast.balanceUsd, 0)
    return {
      scanning: this.scanning,
      totalAssets: this.assets.length,
      totalValueUsd,
      assets: this.assets,
      chainsWithAssets,
      decision: this.lastDecision,
      autoTradeEnabled: this.autoTradeEnabled,
      tradesExecuted: this.tradesExecuted,
      lastScan: this.lastScan,
    }
  }

  stop() {
    if (this.scanInterval) clearInterval(this.scanInterval)
  }
}
