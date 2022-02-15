import { AssetType, AssetSymbolEnum, TokenTypeEnum } from 'types/asset'
import ethpng from 'images/token/ETH.png'


const ETHER_BASE_DECIMAL = 1e18

const assetList: AssetType[] = [
  {
    symbol: AssetSymbolEnum.Source,
    name: 'Source Token',
    loguURI: ethpng,
    tokenAddress: '',
    type: TokenTypeEnum.Source,
    id: 'src',
    mapping: {}
  },
  {
    symbol: AssetSymbolEnum.Destination,
    name: 'Destination Token',
    loguURI: ethpng,
    tokenAddress: '',
    type: TokenTypeEnum.Destination,
    id: 'dst',
    mapping: {}
  }
]
export default {
  assetList,
  ETHER_BASE_DECIMAL
}
