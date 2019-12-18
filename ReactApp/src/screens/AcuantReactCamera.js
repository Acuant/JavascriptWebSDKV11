import React, { Component } from 'react';
import {connect} from "react-redux";

class AcuantReactCamera extends Component {
    constructor(props){
        super(props);
        this.detectedCount = 0;
    }
    componentDidMount() {
        if(window.AcuantCameraUI){
            window.AcuantCameraUI.start((response) => {
              this.props.history.push('/photo/confirm', {
                blurry: response.sharpness < 50,
                hasGlare: response.glare < 50,
                cardImage: response.image.data
              });           
            }, (error) => {
                console.log("error occured", error);
            });
        }
    }

    componentWillUnmount(){
      window.AcuantCameraUI.end();
    }

    render() {
      return(
        <div>
            <video id="acuant-player" controls autoPlay playsInline style={{display:'none' }}></video>
            <div style={{ textAlign:'center' }}>
                <canvas id="acuant-video-canvas" width="100%" height="auto"></canvas>
            </div>
        </div>
      )
    }
}

export default connect()(AcuantReactCamera);
