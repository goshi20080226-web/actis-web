import { useEffect } from "react"
import { ref, get } from "firebase/database"

import { database } from "../firebase/config"


function TestFirebase(){

  useEffect(()=>{

    const test = async()=>{

      const snapshot =
        await get(
          ref(database,"/")
        )


      console.log(
        snapshot.val()
      )

    }


    test()

  },[])


  return(
    <>
      <h1>
        Firebase Test
      </h1>
    </>
  )

}


export default TestFirebase