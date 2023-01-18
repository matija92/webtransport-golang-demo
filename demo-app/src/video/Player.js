import { useEffect, useState } from 'react';
import "./Player.css"
import Log from "./Log"
import Dropdown from "./controls/Dropdown"
import Button from './controls/Button';


const decoderConfig = {
  codec: "avc1.42001E"
}

const streamOptions = 
[
  {
    text: "Select stream type",
    id: ""
  },
  {
    text:"Unidirectional (stream)",
    id: "unis"
  },
  {
    text:"Unidirectional (datagram)",
    id: "unid"
  }
]

 function Player() {
    const [conn, setConn] = useState(null)
    const [bidiStream, setBidiStream] = useState(null)
    const [logs, setLogs] = useState([])
    let l = ["henlo"]

    useEffect(()=>{
      console.log("Logs set")
      console.log(logs)
  }, [logs])


    // WebTransport functions
    async function connect() {
      await inititializeWebtransport("https://localhost:4433/control")
    }

    function log(msg) {
      console.log(msg)
      l.push(msg)
      setLogs(l)
    } 

    function logError() {
      console.error(msg)
      l.push(msg)
      setLogs(l)
    }

    async function inititializeWebtransport(url) {
      log(`Initializing WebTransport connection to ${url}`)
      let transport = new WebTransport(url);
      await transport.ready;
      setConn(transport)
      log("Connection ready!")
      await createBidiStream(transport)
    }

    function closeSession() {
      log("Closing WebTransport session")
      sendCommand(4)
      conn.close()
    }

    async function changeSession(e) {
      switch (e.target.value) {
        case "unis":
          log(`Requesting unidirectional stream`)
          await sendCommand(1)
          receiveFromUniStream()
        case "unid":
          log(`Requesting datagram stream`)
          await sendCommand(2)
          receiveFromDatagrams()
          break
        default:
          break
      }
    }

    async function receiveFromDatagrams() {
      const datagams = conn.datagrams.readable;

      renderFromStream(datagams)
    }


    async function receiveFromUniStream() {
      const uds = conn.incomingUnidirectionalStreams;
      const reader = uds.getReader()

      const {value, done} = await reader.read();
      if (done) {
        return
      }
      log(`Unidirectional stream received`)
      renderFromStream(value)
    }

    async function createBidiStream(conn) {
      const stream = await conn.createBidirectionalStream()
      if (!stream ) {
        logError("Fatal error - could not create bidi stream")
        return
      }
      log("Control stream established")
      setBidiStream(stream)
    }


    // WebCodec and data parsing
    const init = {
      output:(frame) =>{
        const canvas =  document.getElementById("test")
        canvas.width = frame.displayWidth
        canvas.height = frame.displayHeight


        const ctx = canvas.getContext("2d");
        ctx.drawImage(frame, 0, 0)


        frame.close();
      } ,
      error: (e) => {
        logError(e.message);
      },
    };

    async function inititalizeVideoDecoder(c) {
        const { supported } = await VideoDecoder.isConfigSupported(decoderConfig)
        if (!supported) {
          return null
        } 
        let d = new VideoDecoder(init)
        d.configure(decoderConfig)
        return d
    }
    

    async function sendCommand(c) {
      const writer = await bidiStream.writable.getWriter()
      writer.write(Uint8Array.from([c]).buffer)
    }

    
    async function renderFromStream(stream) {
      const reader = await stream.getReader()
      const decoder = await inititalizeVideoDecoder()


      const frameBuffer = []
      let chunk = null
      let currentSize, frameCount = 0

      try {

     
        while (true) {
              const {value, done} = await reader.read();
              if (done) {
                log("Stream is done")
                break;
              }

              
              frameBuffer.push(...value)

              if (frameBuffer.length < 256) {
                continue
              }


              // If current chunk is undefined/null, start reading frame headers
              if (!chunk) {
                const arr = Uint8Array.from(frameBuffer)
                const dataview = new DataView(arr.buffer)
                let t = ""
                try {
                  t = getType(dataview.getUint16(0))
                } catch (error) {
                  frameBuffer.splice(0, 2)
                  continue
                }

                const ts = Number(dataview.getBigUint64(2))
                currentSize = dataview.getUint32(10)

                chunk = {
                  type: t,
                  timestamp: ts
                }

                // Remove header from buffer
                frameBuffer.splice(0, 14)
              }

              // When buffer has enough data, finalize EncodedVideoChunk
              if (currentSize != 0 && frameBuffer.length >= currentSize) {
                const data = frameBuffer.splice(0, currentSize)
                chunk.data =  Uint8Array.from(data).buffer

                decoder.decode(new EncodedVideoChunk(chunk))
                await decoder.flush()
                frameCount++
                chunk = null
                currentSize = 0
              }

          }

      } catch (e) {
        logError(`Error reading from stream ${e.msg}`)
      }
    }

    
    // Get frame type
    function getType(val) {
      switch (val) {
        case 1:
          return "key"
        case 65535:
          return "delta"
        default:
          throw new Error("Invalid frame type")
      }
    }

    return (
      <div className='Player'>
          <div className='Player-controls'>
            <Button name="Open WebTransport session" text="Open" onClickHandler={connect} />
            <Dropdown name="Pick stream" onSelectHandler={changeSession}
              options={streamOptions}>
            </Dropdown>

            <Dropdown name="Rendering method"  options={[{id: "c", text: "Canvas"}]}/>

            <Button name="Close stream" text="Close" onClickHandler={closeSession} />
          </div>
         <div className='Player-video'>
          <canvas id="test" ></canvas>
         </div>
         <div className='Player-logs'>
            <Log logs={logs} />
         </div>
          
      </div>
    ) 
  }

  export default Player;