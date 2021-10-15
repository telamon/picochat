import React from 'react'
import { useHistory } from 'react-router-dom'

const AboutPage = () => {
    const history = useHistory()
    return (
        <>
            <h4>Om oss PicoChat</h4>
            <h6>Lorem ipsum dolor sit amet consectetur, adipisicing elit. Odio, modi!</h6>
            <button className="btn" onClick={() => history.push('/')}>Back to START</button>
        </>
    )
}

export default AboutPage