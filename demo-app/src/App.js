import './App.css';
import './video/Player';
import Player from './video/Player';

function App() {
  return (
    <div className="App">
      <div className="App-body">
      <div className='App-title'>
        <p>WebTransport & WebCodec API Demo</p>
      </div>
      <Player className='App-player' />
      </div>
    </div>
  );
}

export default App;
