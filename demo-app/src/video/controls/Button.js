
import "./Control.css"

function Button(props){
    return ( 
        <div className="Control">
          <div className="Control-name">{props.name}</div>
          <button className="Button" onClick={props.onClickHandler} >{props.text}</button> 
        </div>
    )
  }
  

export default Button;