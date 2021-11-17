import React, { Component, Fragment } from 'react';
import { connect } from "react-redux";
import Processing from "./Processing";
import {setCaptured} from "./actions/capturedActions";
import {bindActionCreators} from "redux";
import Header from './Header';

class AcuantReactCamera extends Component {
  constructor(props) {
    super(props);
    this.detectedCount = 0;
    this.state = {
      processing: false,
      liveCaptureFailed: false
    }
  }

  setProcessing(value) {
    this.setState({
      ...this.state,
      processing: value
    })
  }

  setLiveCaptureFailed(value) {
    this.setState({
      ...this.state,
      liveCaptureFailed: value
    })
  }

  onCaptured(_) {
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

  onFrameAvailable(_) {
    //do nothing
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
        this.startManualCapture();
      }
    }
  }

  startManualCapture() {
    window.AcuantCamera.startManualCapture({
      onCaptured: this.onCaptured.bind(this),
      onCropped: this.onCropped.bind(this)
    }, this.onError.bind(this));
  }

  onError(_, code) {
    if (code === "repeat-fail") {
      this.setLiveCaptureFailed(true);
    } else if (code === "sequence-break") {
      alert("Live Capture failed. Please try again.")
      this.props.history.replace("/capture/photo")
    } else {
      alert("This device does not support Live Capture. Launch manual capture.")
      this.props.history.replace("/capture/photo")
    }
  }

  componentDidMount() {
    this.startCamera()
  }
  componentWillUnmount() {
  }

  render() {
    if (this.state.processing) {
      return <Processing />
    } else if (this.state.liveCaptureFailed) {
      return (
        <Fragment>
          <Header />
          <div className='body column'>
            <div className='row wrapper icon' />
            <div className='row wrapper description_container'>
              <p className='description'>Live camera failed. </p>
            </div>
            <div className="wrapper column">
              <label className='btn' onClick={() => this.startManualCapture()}>
                <p className={'buttonBgText'}>Start manual capture</p>
              </label>
            </div>
          </div>
        </Fragment>
      )
    } else {
      return (
        <div id="acuant-camera"></div>
      )
    }

  }
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators({ setCaptured }, dispatch);
}

export default connect(null, mapDispatchToProps)(AcuantReactCamera);
