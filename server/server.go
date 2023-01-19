package main

import (
	"bytes"
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"math"
	"net/http"
	"time"
	"webtransport-demo/video"

	webtransport "github.com/adriancable/webtransport-go"
)

var Cert = flag.String("cert", "certificate.pem", "Certificate in PEM format")
var CertKey = flag.String("key", "certificate.key", "Certificate key")
var FrameDir = flag.String("frame-dir", "../data/sample/1280/frames/", "Directory with raw frames")

func main() {
	flag.Parse()

	server := &webtransport.Server{
		ListenAddr:     ":4433",
		TLSCert:        webtransport.CertFile{Path: *Cert},
		TLSKey:         webtransport.CertFile{Path: *CertKey},
		AllowedOrigins: []string{"127.0.0.1:3000", "localhost:3000"},
	}
	rawFrames := video.LoadFramesFromDisk(*FrameDir)

	http.HandleFunc("/control", func(rw http.ResponseWriter, r *http.Request) {
		fmt.Println("Received request")
		session := r.Body.(*webtransport.Session)
		session.AcceptSession()
		defer session.CloseSession()
		defer fmt.Println("Closing WebTransport session")

		cmdChan := make(chan byte)
		cmdCtx, cmdCancel := context.WithCancel(context.Background())
		defer cmdCancel()

		go ProcessCommandStream(cmdCtx, session, cmdChan)

		var currentCmd byte = 0xFF
		var currentCtx context.Context
		var currentCancel func()
		//var wg sync.WaitGroup
		for {

			cmd, ok := <-cmdChan
			if !ok {
				fmt.Println("Control channel closed")
				return
			}

			if cmd == currentCmd {
				continue
			}

			if currentCancel != nil {
				currentCancel()
			}

			currentCtx, currentCancel = context.WithCancel(context.Background())

			switch cmd {
			case video.ControlClose:
				return
			case video.ControlDatagram:
				fmt.Println("Starting datagram")
				go WriteFramesToOutput(currentCtx, session, rawFrames)
			case video.ControlStream:
				fmt.Println("Starting uni stream")
				stream, err := session.OpenUniStreamSync(currentCtx)
				if err != nil {
					fmt.Println(err.Error())
					return
				}
				go WriteFramesToOutput(currentCtx, &stream, rawFrames)
			default:
				// End stream on invalid command
				return
			}
		}

	})

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

	})

	ctx, _ := context.WithCancel(context.Background())
	server.Run(ctx)
}

func ProcessCommandStream(ctx context.Context, session *webtransport.Session, cmdChan chan byte) {
	defer close(cmdChan)
	// Wait for incoming bidi stream
	s, err := session.AcceptStream()
	if err != nil {
		return
	}
	defer s.Close()
	defer fmt.Println("Closing stream")

	cmd := make([]byte, 1)
	for {
		n, err := s.Read(cmd)
		if err != nil || n != 1 {
			fmt.Println(err.Error())
			return
		}

		if cmd[0] > video.ControlClose {
			fmt.Println("Invalid command")
			return
		}

		select {
		case <-ctx.Done():
			fmt.Println("Context cancelled")
		case cmdChan <- cmd[0]:
		}

	}

}

func WriteFramesToOutput(ctx context.Context, stream interface{}, frames []*video.Frame) error {
	n := len(frames)
	i := 0

	if s, ok := stream.(*webtransport.SendStream); ok {
		defer s.Close()
	}

	// Loop the video
	for {

		frame := frames[i%n]
		frame.Header.Timestamp = uint64(math.Trunc(float64(i) * video.FrameRate * 1000000)) // in microseconds

		start := time.Now()

		switch s := stream.(type) {
		case *webtransport.Session:
			var b bytes.Buffer
			err := frame.WriteTo(&b)
			if err != nil {
				fmt.Println(err.Error())
				return err
			}

			pkt := make([]byte, 1080)
			for n, err := b.Read(pkt); err == nil && n > 0; n, err = b.Read(pkt) {
				err = s.SendMessage(pkt)
				if err != nil {
					fmt.Println(err.Error())
					return err
				}
			}
			if err != nil && !errors.Is(err, io.EOF) {
				fmt.Println(err.Error())
				return err
			}
		case *webtransport.SendStream:
			err := frame.WriteTo(s)
			if err != nil {
				return err
			}
		default:
			return errors.New("Invalid stream")
		}

		i++
		var sleepTime time.Duration
		if time.Since(start) < time.Second/30 {
			sleepTime = time.Second/30 - time.Since(start)
		}

		select {
		case <-ctx.Done():
		case <-time.After(sleepTime):
		}

	}
}

func EncodeFrames(ctx context.Context, stream io.Writer, frames []*video.Frame) error {

	return WriteFramesToOutput(ctx, stream, frames)
}
