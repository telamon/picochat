import React from 'react';
import { useHistory } from 'react-router-dom'


const Bar = () => {
    const history = useHistory()
    return (
        <div >
            <h4>Here is Bar's</h4>
<button className="btn" onClick={() => history.push('/')}>Back to START</button>

           
        </div>
    )
}

export default Bar