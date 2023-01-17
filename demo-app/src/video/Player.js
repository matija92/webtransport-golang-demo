import { useEffect, useState } from 'react';
import "./Player.css"
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
    text:"Bidirectional (stream)",
    id: "bidi"
  },
  {
    text:"Unidirectional (datagram)",
    id: "uni"
  }
]

 function Player() {
    const [conn, setConn] = useState(null)
    const [bidiStream, setBidiStream] = useState(null)


    // WebTransport functions
    async function connect() {
      await inititializeWebtransport("https://localhost:4433/live")
    }

    async function inititializeWebtransport(url) {
      let transport = new WebTransport(url);
      await transport.ready;
      setConn(transport)
      console.log("Connection ready!")
    }

    function closeStream() {
      conn.close()
    }

    function createStream(e) {
      switch (e.target.value) {
        case "bidi":
          createBidiStream()
        case "uni":
          // TODO
          break
        default:
          break
      }
    }

    async function createBidiStream() {
      const stream = await conn.createBidirectionalStream()
      if (!stream ) {
        console.error("Fatal error - could not create bidi stream")
        return
      }
      setBidiStream(stream)
      await readFromBidiStream(stream)
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
        console.log(e.message);
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
    

  
    async function readFromBidiStream(stream) {
      const reader = await stream.readable.getReader()
      const decoder = await inititalizeVideoDecoder()


      const frameBuffer = []
      let chunk = null
      let currentSize, frameCount = 0

      try {

     
        while (true) {
              const {value, done} = await reader.read();
              if (done) {
                console.info("Bidi stream is done")
                break;
              }

              
              frameBuffer.push(...value)


              // If current chunk is undefined/null, start reading frame headers
              if (!chunk) {
                const arr = Uint8Array.from(frameBuffer)
                const dataview = new DataView(arr.buffer)
                const t = getType(dataview.getUint16(0))
                const ts = Number(dataview.getBigUint64(2))
                currentSize = dataview.getUint32(10)
                if (t == "") {
                  console.warn("invalid data, potential packet loss")
                }

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
        console.log(`Error reading from stream ${e}`)
      }
      
      console.info("Exiting bidi stream reader")
    }

    
    // Get frame type
    function getType(val) {
      switch (val) {
        case 1:
          return "key"
        case 65535:
          return "delta"
        default:
          return ""
      }
    }

    return (
      <div className='Player'>
          <div className='Player-controls'>
            <Button name="Open WebTransport session" text="Open" onClickHandler={connect} />
            <Dropdown name="Pick stream" onSelectHandler={createStream}
              options={streamOptions}>
            </Dropdown>

            <Dropdown name="Rendering method"  options={[{id: "c", text: "Canvas"}]}/>

            <Button name="Close stream" text="Close" onClickHandler={closeStream} />
          </div>
         <div className='Player-video'>
          <canvas id="test" ></canvas>
         </div>
          
      </div>
    ) 
  }

  export default Player;