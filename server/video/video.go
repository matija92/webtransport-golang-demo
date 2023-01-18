package video

import (
	"encoding/binary"
	"fmt"
	"io"
)

const (
	ControlStream byte = iota + 1
	ControlDatagram
	ControlBidi
	ControlClose
)

type FrameType uint16

const (
	Key   FrameType = 0x0001
	Delta FrameType = 0xffff
)

type FrameHeader struct {
	Type      FrameType
	Timestamp uint64
	Size      uint32
}

type Frame struct {
	Header FrameHeader
	Data   []byte
}

func (f *Frame) WriteTo(w io.Writer) error {
	err := binary.Write(w, binary.BigEndian, f.Header)
	if err != nil {
		fmt.Println(err.Error())
		return err
	}

	_, err = w.Write(f.Data)
	if err != nil {
		fmt.Println(err.Error())
		return err
	}

	return nil
}
