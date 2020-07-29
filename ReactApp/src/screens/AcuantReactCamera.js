import React, { Component } from 'react';
import { connect } from "react-redux";
import Processing from "./Processing";
import {setCaptured} from "./actions/capturedActions";
import {bindActionCreators} from "redux";

class AcuantReactCamera extends Component {
  constructor(props) {
    super(props);
    this.detectedCount = 0;
    this.state = {
      processing: false
    }
  }

  setProcessing(value) {
    this.setState({
      processing: value
    })
  }

  onCaptured(response) {
    //document captured
    //this is not the final result of processed image
    //show a loading screen until onCropped is called
    this.setProcessing(true);
  }

  onCropped(response) {
    this.setProcessing(false);
    if (response) {
      //use response
      this.props.setCaptured(response);
      this.props.history.push('/photo/confirm')
    }
    else {
      //cropping error
      //restart capture
      this.startCamera()
    }
  }

  onFrameAvailable(response) {

  }

  startCamera(){
    if (window.AcuantCameraUI) {
      if (window.AcuantCamera.isCameraSupported) {
        window.AcuantCameraUI.start({
          onCaptured: this.onCaptured.bind(this), 
          onCropped: this.onCropped.bind(this), 
          onFrameAvailable: this.onFrameAvailable.bind(this)
        }, this.onError.bind(this));
      }
      else {
        window.AcuantCamera.startManualCapture({
          onCaptured: this.onCaptured.bind(this), 
          onCropped: this.onCropped.bind(this)
        }, this.onError.bind(this));
      }
    }
  }

  onError(err){
    window.AcuantCamera.isCameraSupported = false
    alert("This device does not support Live Capture. Manual Capture will be started. Please try again.")
    this.props.history.replace("/capture/photo")
  }

  componentDidMount() {
    this.startCamera()
  }
  componentWillUnmount() {
  }

  render() {
    if (this.state.processing) {
      return <Processing />
    }
    else {
      return (
        <div>
          <video id="acuant-player" controls autoPlay playsInline style={{ display: 'none' }}></video>
          <div style={{ textAlign: 'center' }}>
            <canvas id="acuant-video-canvas" width="100%" height="auto"></canvas>
          </div>
        </div>
      )
    }

  }
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators({ setCaptured }, dispatch);
}

export default connect(null, mapDispatchToProps)(AcuantReactCamera);
