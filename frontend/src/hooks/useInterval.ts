import {useEffect, useRef } from 'react'

function useInterval(callback: () => Promise<void>, delay: number | null) : void{
  const savedCallback = useRef()

  // Remember the latest callback.
  useEffect(() => {
    // @ts-ignore
    savedCallback.current = callback
  }, [callback])

  // Set up the interval.
  useEffect(() => {
    function tick() : void{
      // @ts-ignore
      savedCallback.current()
    }

    if (delay !== null) {
      let id = setInterval(tick, delay)
      return () :void => clearInterval(id)
    }
  }, [delay])
}

export default useInterval;
