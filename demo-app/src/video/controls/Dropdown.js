
import "./Control.css"

function Dropdown(props){
    return ( 
        <div className="Control">
          <div className="Control-name">{props.name}</div>
          
          <select name="cars" id="cars" onChange={props.onSelectHandler}>
            {
              props.options.map(item => <option value={item.id} key={item.id}>{item.text}</option>)
            }
          </select>
        </div>
    )
  }
  

export default Dropdown;