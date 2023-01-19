
import "./Control.css"

function Dropdown(props){
    return ( 
        <div className="Control">
          <div className="Control-name">{props.name}</div>
          
          <select name={props.id} id={props.id} onChange={props.onSelectHandler}>
            {
              props.options.map(item => <option value={item.id} key={item.id}>{item.text}</option>)
            }
          </select>
        </div>
    )
  }
  

export default Dropdown;