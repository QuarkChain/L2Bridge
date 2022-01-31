import BigNumber from 'bignumber.js'
import { NETWORK } from 'consts'
import { AssetType } from 'types/asset'

const useFee = (): {
  getFee: ({
    token,
    amount
  }: {
    token: AssetType
    amount: BigNumber
  }) => Promise<BigNumber>
} => {

  const feeRatio = new BigNumber(0.0005)
  let minFeeDollar = new BigNumber(1)

  const getFee = async ({
    token,
    amount
  }: {
    token: AssetType
    amount: BigNumber
  }): Promise<BigNumber> => {
    if (!token.id) {
      return new BigNumber(0)
    }
    try {
      let url = NETWORK.COINGECKO_API + "?ids=" + token.id + "&vs_currencies=usd"
      const res = await fetch(url);
      const json = await res.json();
      const price = new BigNumber(json[token.id].usd)
      const feeAmount = amount.times(feeRatio)
      const decimalSize = new BigNumber(token?.decimal || 18).toNumber()
      const decimalExp = new BigNumber(10).pow(decimalSize)
      const minFeeAmount = minFeeDollar.times(decimalExp).div(price)
      return feeAmount.gt(minFeeAmount) ? feeAmount : minFeeAmount
    }
    catch (e) {
        console.log(e)
    }

    return new BigNumber(0)

  }


  return {
    getFee
  }
}

export default useFee
