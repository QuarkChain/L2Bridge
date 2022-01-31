import { AssetType, AssetSymbolEnum, TokenTypeEnum } from 'types/asset'
import emptypng from 'images/token/Empty.png'
import smtypng from 'images/token/SMTY.png'
import dlsvg from 'images/token/DL.svg'
import kkksvg from 'images/token/KKK.svg'
import ethpng from 'images/token/ETH.png'
import bnbpng from 'images/token/BNB.png'
import btcbpng from 'images/token/BTCB.png'
import busdpng from 'images/token/BUSD.png'
import usdtpng from 'images/token/USDT.png'
import usdcpng from 'images/token/USDC.png'
import qkcpng from 'images/token/QKC.png'


const ETHER_BASE_DECIMAL = 1e18

const assetList: AssetType[] = [
  {
    symbol: AssetSymbolEnum.BTCB,
    name: 'Binance Bitcoin',
    loguURI: btcbpng,
    tokenAddress: '',
    type: TokenTypeEnum.Canonical,
    id: 'binance-bitcoin'
  },
  {
    symbol: AssetSymbolEnum.USDT,
    name: 'Tether USD',
    loguURI: usdtpng,
    tokenAddress: '',
    type: TokenTypeEnum.Canonical,
    id: 'tether'
  },
  {
    symbol: AssetSymbolEnum.USDC,
    name: 'USD Coin',
    loguURI: usdcpng,
    tokenAddress: '',
    type: TokenTypeEnum.Canonical,
    id: 'usd-coin'
  },
  {
    symbol: AssetSymbolEnum.BUSD,
    name: 'Binance USD',
    loguURI: busdpng,
    tokenAddress: '',
    type: TokenTypeEnum.Canonical,
    id: 'binance-usd'
  },
  {
    symbol: AssetSymbolEnum.BNB,
    name: 'Binance Chain',
    loguURI: bnbpng,
    tokenAddress: '',
    type: TokenTypeEnum.Native,
    id: 'binancecoin'
  },
  {
    symbol: AssetSymbolEnum.WBNB,
    name: 'Wrapped BNB',
    loguURI: bnbpng,
    tokenAddress: '',
    type: TokenTypeEnum.Canonical,
    id: 'wbnb'
  },
  {
    symbol: AssetSymbolEnum.ETH,
    name: 'Ethereum',
    loguURI: ethpng,
    tokenAddress: '',
    type: TokenTypeEnum.Canonical,
    id: 'ethereum'
  },
  {
    symbol: AssetSymbolEnum.DL,
    name: 'DengLun',
    loguURI: dlsvg,
    tokenAddress: '',
    type: TokenTypeEnum.Canonical,
    id: 'usd-coin'
  },
  {
    symbol: AssetSymbolEnum.KKK,
    name: 'KKK Test Token',
    loguURI: kkksvg,
    tokenAddress: '',
    type: TokenTypeEnum.Canonical,
    id: 'usd-coin'
  },
  {
    symbol: AssetSymbolEnum.SMTY,
    name: 'SMTYToken',
    loguURI: smtypng,
    tokenAddress: '',
    type: TokenTypeEnum.Canonical,
    id: 'smoothy'
  },
  {
    symbol: AssetSymbolEnum.PM,
    name: 'PM',
    loguURI: emptypng,
    tokenAddress: '',
    type: TokenTypeEnum.Canonical,
    id: 'usd-coin'
  },
  {
    symbol: AssetSymbolEnum.QI,
    name: 'QI',
    loguURI: emptypng,
    tokenAddress: '',
    type: TokenTypeEnum.Canonical,
    id: 'usd-coin'
  },
  {
    symbol: AssetSymbolEnum.QKC,
    name: 'QuarkChain',
    loguURI: qkcpng,
    tokenAddress: '',
    type: TokenTypeEnum.Canonical,
    id: 'quark-chain'
  },

  {
    symbol: AssetSymbolEnum.BTCB,
    name: 'QKC Wrapped BTCB',
    loguURI: btcbpng,
    tokenAddress: '',
    type: TokenTypeEnum.Wrapped,
    id: 'binance-bitcoin'
  },
  {
    symbol: AssetSymbolEnum.USDT,
    name: 'QKC Wrapped USDT',
    loguURI: usdtpng,
    tokenAddress: '',
    type: TokenTypeEnum.Wrapped,
    id: 'tether'
  },
  {
    symbol: AssetSymbolEnum.USDC,
    name: 'QKC Wrapped USDC',
    loguURI: usdcpng,
    tokenAddress: '',
    type: TokenTypeEnum.Wrapped,
    id: 'usd-coin'
  },
  {
    symbol: AssetSymbolEnum.BUSD,
    name: 'QKC Wrapped BUSD',
    loguURI: busdpng,
    tokenAddress: '',
    type: TokenTypeEnum.Wrapped,
    id: 'binance-usd'
  },
  {
    symbol: AssetSymbolEnum.WBNB,
    name: 'QKC Wrapped WBNB',
    loguURI: bnbpng,
    tokenAddress: '',
    type: TokenTypeEnum.Wrapped,
    id: 'wbnb'
  },
  {
    symbol: AssetSymbolEnum.ETH,
    name: 'QKC Wrapped ETH',
    loguURI: ethpng,
    tokenAddress: '',
    type: TokenTypeEnum.Wrapped,
    id: 'ethereum'
  },
  {
    symbol: AssetSymbolEnum.DL,
    name: 'QKC Wrapped DL',
    loguURI: dlsvg,
    tokenAddress: '',
    type: TokenTypeEnum.Wrapped,
    id: 'usd-coin'
  },
  {
    symbol: AssetSymbolEnum.KKK,
    name: 'QKC Wrapped KKK',
    loguURI: kkksvg,
    tokenAddress: '',
    type: TokenTypeEnum.Wrapped,
    id: 'usd-coin'
  },
  {
    symbol: AssetSymbolEnum.SMTY,
    name: 'QKC Wrapped SMTY',
    loguURI: smtypng,
    tokenAddress: '',
    type: TokenTypeEnum.Wrapped,
    id: 'smoothy'
  },
  {
    symbol: AssetSymbolEnum.PM,
    name: 'QKC Wrapped PM',
    loguURI: emptypng,
    tokenAddress: '',
    type: TokenTypeEnum.Wrapped,
    id: 'usd-coin'
  },
  {
    symbol: AssetSymbolEnum.QI,
    name: 'QKC Wrapped QI',
    loguURI: emptypng,
    tokenAddress: '',
    type: TokenTypeEnum.Wrapped,
    id: 'usd-coin'
  },
  {
    symbol: AssetSymbolEnum.QKC,
    name: 'QuarkChain',
    loguURI: qkcpng,
    tokenAddress: '',
    type: TokenTypeEnum.Native,
    id: 'quark-chain'
  },
  {
    symbol: AssetSymbolEnum.WQKC,
    name: 'QKC Wrapped QKC',
    loguURI: qkcpng,
    tokenAddress: '',
    type: TokenTypeEnum.Wrapped,
    id: 'quark-chain'
  }
]
export default {
  assetList,
  ETHER_BASE_DECIMAL
}
