import {useEffect,useMemo,useState} from "react"
import {onAuthStateChanged} from "firebase/auth"
import {get,ref} from "firebase/database"
import {auth,database} from "../firebase/config"
import {useDataset} from "../context/DatasetContext"
import DatasetSelector from "../components/dataset/DatasetSelector"
import "./DepartureBoard.css"

const userReady=()=>new Promise(resolve=>{
  if(auth.currentUser)return resolve(auth.currentUser)
  const u=onAuthStateChanged(auth,x=>{u();resolve(x)})
})
const sec=v=>{
  const s=String(v??"").replace(/[^0-9]/g,"");if(!s)return -1
  if(s.length<=4)return Number(s.slice(0,-2)||0)*3600+Number(s.slice(-2))*60
  return Number(s.slice(0,-4)||0)*3600+Number(s.slice(-4,-2))*60+Number(s.slice(-2))
}
const fmt=v=>{const n=sec(v);if(n<0)return"--:--";return String(Math.floor(n/3600)).padStart(2,"0")+":"+String(Math.floor(n%3600/60)).padStart(2,"0")}
const color=v=>{const s=String(v??"").trim().replace(/^0x/i,"");if(/^#[0-9a-f]{6}$/i.test(s))return s;if(/^[0-9a-f]{8}$/i.test(s))return"#"+s.slice(6,8)+s.slice(4,6)+s.slice(2,4);if(/^[0-9a-f]{6}$/i.test(s))return"#"+s;return"#fff"}
const match=(s,n)=>[s?.name,s?.shortName,s?.timeName,s?.EkimeiJikokuRyaku].filter(Boolean).map(x=>String(x).replace(/\s/g,"")).includes(String(n).replace(/\s/g,""))
const stationOf=(t,n)=>(Array.isArray(t?.stations)?t.stations:[]).find(s=>match(s,n))
const destination=t=>t?.destination||t?.finalDest||t?.stations?.at(-1)?.name||"—"
const typeColor=(t,three)=>{if(three){const n=String(t?.type||"普通");if(/特急|快急|急行/.test(n))return"#f00";if(/快速|準急|通急/.test(n))return"#0f0";return"#f90"}return color(t?.trainTypeColor||t?.JikokuhyouMojiColor||t?.typeColor)}
const isStop=s=>{
  if(!s)return false;
  if(s.isPass===true)return false;
  const type=String(s.stopType??"1");
  if(type==="0"||type==="2"||type==="3")return false;
  return Boolean(s.arrival||s.departure||s.single);
}
const isRouteStation=s=>{
  if(!s)return false;
  const type=String(s.stopType??"1");
  return type!=="0"&&type!=="3";
}
const nextMessage=(t,n)=>{
  const a=Array.isArray(t?.stopGuide)?t.stopGuide:[];
  if(!a.length)return"";
  const i=a.findIndex(s=>match(s,n));
  if(i<0)return"";

  // 通過駅(stopType=2)は時刻を持たないため、時刻の有無では絞らない。
  // 列車が実際に走る区間の終端までを対象にする。
  let endIndex=-1;
  for(let j=a.length-1;j>=i+1;j--){
    if(isRouteStation(a[j])){endIndex=j;break}
  }
  if(endIndex<i+1)return"";

  const future=a.slice(i+1,endIndex+1);
  const stopFlags=future.map(isStop);
  const stopCount=stopFlags.filter(Boolean).length;
  if(!stopCount)return"";
  if(stopCount===future.length)return"各駅に止まります";

  const runs=[];
  let runStart=0;
  for(let j=0;j<stopFlags.length;j++){
    if(j===stopFlags.length-1||stopFlags[j+1]!==stopFlags[j]){
      runs.push({
        stop:stopFlags[j],
        start:runStart,
        end:j,
        length:j-runStart+1
      });
      runStart=j+1;
    }
  }

  const firstRun=runs[0]?.stop?runs[0]:null;
  const lastRun=runs[runs.length-1]?.stop?runs[runs.length-1]:null;
  const prefix3=firstRun&&firstRun.start===0&&firstRun.length>=3;
  const suffix3=lastRun&&lastRun.end===future.length-1&&lastRun.length>=3;

  const stopNames=future.filter(isStop).map(s=>s.name||s.timeName||"").filter(Boolean);

  if(prefix3&&!suffix3){
    const prefixNames=future.slice(firstRun.start,firstRun.end+1).filter(isStop).map(s=>s.name||s.timeName||"").filter(Boolean);
    const afterNames=future.slice(firstRun.end+1).filter(isStop).map(s=>s.name||s.timeName||"").filter(Boolean);
    const prefixEnd=prefixNames.at(-1);
    return afterNames.length
      ?"停車駅は、"+prefixEnd+"までの各駅と、"+afterNames.join("、")+"です"
      :"停車駅は、"+prefixEnd+"までの各駅です";
  }

  if(suffix3&&!prefix3){
    const beforeNames=future.slice(0,lastRun.start).filter(isStop).map(s=>s.name||s.timeName||"").filter(Boolean);
    const suffixNames=future.slice(lastRun.start).filter(isStop).map(s=>s.name||s.timeName||"").filter(Boolean);
    const suffixStart=suffixNames[0];
    return beforeNames.length
      ?"停車駅は、"+beforeNames.join("、")+"と、"+suffixStart+"から先の各駅です"
      :"停車駅は、"+suffixStart+"から先の各駅です";
  }

  return"停車駅は、"+stopNames.join("、")+"です";
}


export default function DepartureBoard(){
  const {selectedDatasetId}=useDataset()
  const [lines,setLines]=useState([])
  const [trains,setTrains]=useState([])
  const [station,setStation]=useState("")
  const [dir,setDir]=useState("ALL")
  const [led,setLed]=useState("full")
  const [cars,setCars]=useState(true)
  const [virtual,setVirtual]=useState("")
  const [now,setNow]=useState(new Date())
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState("")

  useEffect(()=>{
    let stop=false
    ;(async()=>{
      try{
        const u=await userReady()
        if(!u){
          setError("ACTISアカウントにログインしてください。")
          return
        }
        const [a,b]=await Promise.all([
          get(ref(database,"users/"+u.uid+"/lines")),
          get(ref(database,"users/"+u.uid+"/trains"))
        ])
        const ls=a.exists()?a.val():{}
        const ts=b.exists()?b.val():{}
        if(stop)return
        setLines(Object.entries(ls).map(([id,v])=>({id,...v})).filter(x=>!selectedDatasetId||String(x.datasetId)===String(selectedDatasetId)))
        setTrains(Object.entries(ts).map(([id,v])=>({id,...v})).filter(x=>!selectedDatasetId||String(x.datasetId)===String(selectedDatasetId)))
      }catch(e){
        if(!stop)setError("発車標データを取得できませんでした："+e.message)
      }finally{
        if(!stop)setLoading(false)
      }
    })()
    return()=>{stop=true}
  },[selectedDatasetId])

  useEffect(()=>{
    const i=setInterval(()=>setNow(new Date()),1000)
    return()=>clearInterval(i)
  },[])

  const time=useMemo(()=>{
    if(!virtual)return now
    const parts=virtual.split(":").map(Number)
    const d=new Date(now)
    d.setHours(parts[0]||0,parts[1]||0,parts[2]||0,0)
    return d
  },[now,virtual])

  const nowSec=time.getHours()*3600+time.getMinutes()*60+time.getSeconds()

  const stations=useMemo(()=>{
    const result=[],seen=new Set()
    lines.forEach(l=>(l.stations||[]).forEach(s=>{
      const n=s?.name
      if(n&&!seen.has(n)){
        seen.add(n)
        result.push(n)
      }
    }))
    return result
  },[lines])

  useEffect(()=>{
    if(!station&&stations[0])setStation(stations[0])
    else if(station&&!stations.includes(station))setStation(stations[0]||"")
  },[stations,station])

  const upcoming=useMemo(()=>trains
    .filter(t=>dir==="ALL"||t.direction===dir)
    .map(t=>{
      const s=stationOf(t,station)
      if(!s||s.isPass||String(s.stopType??"1")==="2")return null
      const raw=s.departure||s.single
      const n=sec(raw)
      if(n<0)return null
      let actual=n
      while(actual-nowSec<-5)actual+=86400
      return{
        id:t.id||t.trainNo,
        t,
        type:t.type||t.typeShort||"普通",
        time:fmt(raw),
        actual,
        diff:actual-nowSec,
        dest:destination(t),
        track:s.track||s.trackName||"",
        cars:t.cars||t.carCount||t.carsCount||"",
        msg:nextMessage(t,station),
        color:typeColor(t,led==="3color")
      }
    })
    .filter(Boolean)
    .sort((a,b)=>a.actual-b.actual),
    [trains,dir,station,nowSec,led]
  )

  useEffect(()=>{
    const update=()=>{
      document.querySelectorAll(".departure-message").forEach(el=>{
        const track=el.querySelector(".departure-message-track")
        if(!track)return
        el.classList.remove("is-scrolling")
        el.style.removeProperty("--message-distance")
        el.style.removeProperty("--message-duration")
        const distance=track.scrollWidth-el.clientWidth
        if(distance<=1)return
        el.style.setProperty("--message-distance",Math.ceil(distance)+"px")
        const duration=Math.max(7.5,(distance/55)+0.3)
        el.style.setProperty("--message-duration",duration+"s")
        el.classList.add("is-scrolling")
      })
    }
    const id=requestAnimationFrame(update)
    const onResize=()=>requestAnimationFrame(update)
    window.addEventListener("resize",onResize)
    return()=>{
      cancelAnimationFrame(id)
      window.removeEventListener("resize",onResize)
    }
  },[trains,cars,station,dir])

  const groups=dir==="ALL"
    ?[["Nobori","上り"],["Kudari","下り"]]
    :[[dir,dir==="Nobori"?"上り":"下り"]]

  if(loading)return<><DatasetSelector/><h1>駅発車標</h1><p>読み込み中...</p></>
  if(error)return<><DatasetSelector/><h1>駅発車標</h1><p>{error}</p></>

  return<div className="departure-board-page">
    <DatasetSelector/>
    <div className="departure-controls">
      <label>駅 <select value={station} onChange={e=>setStation(e.target.value)}>{stations.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>方面 <select value={dir} onChange={e=>setDir(e.target.value)}>
        <option value="ALL">すべて</option>
        <option value="Nobori">上り</option>
        <option value="Kudari">下り</option>
      </select></label>
      <label>表示 <select value={led} onChange={e=>setLed(e.target.value)}>
        <option value="full">フルカラー</option>
        <option value="3color">3色LED</option>
      </select></label>
      <label><input type="checkbox" checked={cars} onChange={e=>setCars(e.target.checked)}/> 両数</label>
      <label>仮想時刻 <input type="time" step="1" value={virtual} onChange={e=>setVirtual(e.target.value)}/></label>
      <button onClick={()=>setVirtual("")}>解除</button>
    </div>

    <div className="departure-board">
      <div className="departure-clock">
        {String(time.getHours()).padStart(2,"0")}:{String(time.getMinutes()).padStart(2,"0")}:{String(time.getSeconds()).padStart(2,"0")}
      </div>
      {groups.map(([key,title])=>{
        const rows=upcoming.filter(x=>x.t.direction===key).slice(0,3)
        return<section key={key}>
          <h2>{dir==="ALL"?title:""}</h2>
          <div className={"departure-head "+(cars?"cars":"")}>
            <span>種別</span><span>発時刻</span><span>行先</span>
            {cars&&<span>両数</span>}
            <span>のりば</span><span>ご案内</span>
          </div>
          {rows.map(x=><div className={"departure-row "+(cars?"cars ":"")+(x.diff<=5&&x.diff>=-5?"blink":"")} key={x.id}>
            <b style={{color:"#fff",backgroundColor:x.color,borderColor:x.color}}>{x.type}</b>
            <strong>{x.time}</strong>
            <span>{x.dest}</span>
            {cars&&<span>{x.t.cars||x.t.carCount||"—"}</span>}
            <span>{x.track||"—"}</span>
            <span className="departure-message"><span className="departure-message-track">{x.msg}</span></span>
          </div>)}
          {Array.from({length:3-rows.length},(_,i)=><div className={"departure-row blank "+(cars?"cars":"")} key={i}/>)}
        </section>
      })}
    </div>
  </div>
}
