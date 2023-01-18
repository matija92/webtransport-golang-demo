import "./Log.css"

function Log(props) {

  return (
      props.logs.map(item => {
        return <div className='Log-item'>{item}</div>
      })
    
  )
}

export default Log;