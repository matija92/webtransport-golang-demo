package main

import (
	"context"
	"encoding/binary"
	"flag"
	"fmt"
	"math"
	"net/http"
	"time"

	webtransport "github.com/adriancable/webtransport-go"
)

var Cert = flag.String("cert", "certificate.pem", "Certificate in PEM format")
var CertKey = flag.String("key", "certificate.key", "Certificate key")
var FrameDir = flag.String("frame-dir", "../data/sample/640/frames/", "Directory with raw frames")

func main() {
	flag.Parse()

	server := &webtransport.Server{
		ListenAddr:     ":4433",
		TLSCert:        webtransport.CertFile{Path: *Cert},
		TLSKey:         webtransport.CertFile{Path: *CertKey},
		AllowedOrigins: []string{"127.0.0.1:3000", "localhost:3000"},
	}

	http.HandleFunc("/live", func(rw http.ResponseWriter, r *http.Request) {
		fmt.Println("Received request")
		session := r.Body.(*webtransport.Session)
		session.AcceptSession()
		defer session.CloseSession()
		defer fmt.Println("Closing WebTransport session")

		// Wait for incoming bidi stream
		s, err := session.AcceptStream()
		if err != nil {
			return
		}
		defer s.Close()
		defer fmt.Println("Closing stream")

		rawFrames := LoadFramesFromDisk(*FrameDir)
		n := len(rawFrames)
		i := 0

		// Loop the video
		for {
			frame := rawFrames[i%n]
			frame.Header.Timestamp = uint64(math.Trunc(float64(i) * FrameRate * 1000000)) // in microseconds
			//fmt.Printf("Frame %d: Type %d, Timestamp: %v, Size: %d\n", i, frame.Header.Type, time.Duration(frame.Header.Timestamp)*time.Microsecond, frame.Header.Size)
			err := binary.Write(s, binary.BigEndian, frame.Header)
			if err != nil {
				fmt.Println(err.Error())
				return
			}

			start := time.Now()
			_, err = s.Write(frame.Data)
			if err != nil {
				fmt.Println(err.Error())
				return
			}
			if time.Since(start) < time.Second/30 {
				time.Sleep(time.Second/30 - time.Since(start))
			}
			i++
		}
	})

	ctx, _ := context.WithCancel(context.Background())
	server.Run(ctx)
}
