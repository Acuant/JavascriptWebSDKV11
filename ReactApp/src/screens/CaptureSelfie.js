import React, { Component, Fragment } from 'react';
import Header from './Header';
import { connect } from "react-redux";
import FaceMatchService from "../services/api/faceMatch";
import { bindActionCreators } from "redux";
import { processID } from "./actions/processDataActions";
import Processing from "./Processing";

class CaptureSelfie extends Component {

    constructor(props) {
        super(props);
        this.state = {
            loading: false,
            inputValue: '',
            selfie: null
        };
    }

    componentDidMount() {
        let { instanceID } = this.props;
        this.props.processID(instanceID);
    }

    processSelfieAndRedirect() {
        if (this.props.resultData !== null) {
            if (this.props.resultData.Photo.split(',')[1] !== undefined) {
                if (this.state.selfie !== null) {
                    FaceMatchService.processFaceMatch({
                        'Data': {
                            'ImageOne': this.props.resultData.Photo.split(',')[1],
                            'ImageTwo': this.state.selfie
                        },
                        'Settings': {
                            'SubscriptionId': process.env.REACT_APP_SUBSCRIPTION_ID
                        }
                    }).then(res => {
                        this.setState({loading: false});
                        this.props.dispatch({ payload: res.Score, type: '@@acuant/ADD_FACE_MATCH_DATA' });
                        this.props.history.push('/results/default');
                    })
                        .catch(err => {
                            throw new Error(err);
                        });
                }
            } else {
                this.props.history.push('/results/default');
            }
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevProps.resultData !== this.props.resultData) {
            this.processSelfieAndRedirect();
        }
    }

    updateInputValue(evt) {
        let self = this;
        let file = evt.target;
        let reader = new FileReader();
        reader.readAsDataURL(file.files[0]);
        reader.onload = (e) => {

            self.setState({ loading: true });
            let img = document.createElement("img");
            img.src = e.target.result;
            img.onload = function () {

                let canvas = document.createElement("canvas");
                let ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);

                let MAX_WIDTH = 480;
                let MAX_HEIGHT = 640;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                let dataurl = canvas.toDataURL(file.files[0].type, 90 * .01);
                let selfie = dataurl.split(",")[1];
                self.setState({
                    selfie
                }, () => {
                    self.forceUpdate();
                    self.processSelfieAndRedirect();
                })
            };

        };
    }

    openFrontCamera() {
        window.AcuantPassiveLiveness.startSelfieCapture(this.onCaptured.bind(this));
    }

    onCaptured(image) {
        this.setState({loading: true});
        window.AcuantPassiveLiveness.postLiveness({
            endpoint: process.env.REACT_APP_LIVENESS_ENDPOINT,
            token: (function(){
                if(process.env.NODE_ENV === 'development'){
                    return btoa(`${process.env.REACT_APP_USER_NAME}:${process.env.REACT_APP_PASSWORD}`);
                }
                else{
                    return process.env.REACT_APP_AUTH_TOKEN;
                }
            })(),
            image: image,
            subscriptionId: process.env.REACT_APP_SUBSCRIPTION_ID
        }, function (result) {
            this.props.dispatch({ payload: result, type: '@@acuant/ADD_FACE_LIVENESS_DATA' });
            this.setState({
                selfie: image
            }, () => {
                this.forceUpdate();
                this.processSelfieAndRedirect();
            })
        }.bind(this));
    }

    render() {
        if (this.state.loading) {
            return <Processing />
        }
        return (
            <Fragment>

                <Header />

                <div className='body column capture_photo'>

                    <div className='row wrapper description_container'>
                        <p className='description'>Take a selfie image using the front camera of your device.</p>
                    </div>

                    <div className="capture_group">

                        <div className='row wrapper capture_container'>
                            <img alt='idscango' className='capture' src={require('../assets/images/illustration2@3x.png')} />
                        </div>

                        <div className="wrapper column capture_controls">

                            <label className='btn' onClick={this.openFrontCamera.bind(this)}>
                                <p className={'buttonBgText'}>Take selfie image</p>
                            </label>
                            <div className='btn outline' onClick={() => { this.props.history.push('/results/default') }}>
                                <p className={'buttonBdText'}>Skip this step</p>
                            </div>

                        </div>

                    </div>

                </div>

            </Fragment>
        );
    }
}

function mapStateToProps(state) {
    return {
        instanceID: state.config.instanceID,
        faceMatch: state.processedData.faceMatch,
        resultData: state.processedData.result,
        liveness: state.processedData.liveness
    }
}

function mapDispatchToProps(dispatch) {
    let actions = bindActionCreators({ processID }, dispatch);
    return { ...actions, dispatch };
}

export default connect(mapStateToProps, mapDispatchToProps)(CaptureSelfie);
