import React, {Component} from 'react';
import '@babel/polyfill';
import {Switch, Route, Redirect} from 'react-router-dom';
import { ConnectedRouter } from 'connected-react-router'
import {PersistGate} from 'redux-persist/es/integration/react';
import {isMobile} from "react-device-detect";
import {Provider} from 'react-redux';
import CapturePhoto from './screens/CapturePhoto';
import EulaPage from './screens/Eula';
import CaptureSelfie from './screens/CaptureSelfie';
import Results from './screens/Results/index';
import Error from './screens/Error/index';
import "./styles/main.css";
import ProcessedImageResult from "./screens/ProcessedImageResult";
import AcuantReactCamera from "./screens/AcuantReactCamera";

/*
global Raven
 */

class App extends Component {

    constructor(props) {
        super(props);
        this.state = {
            isAcuantSdkLoaded: false
        }
        this.isInitialized = false;
        this.isIntializing = false;
    }

    componentDidMount() {
        if (process.env.REACT_APP_SENTRY_SUBSCRIPTION_ID && process.env.REACT_APP_SENTRY_SUBSCRIPTION_ID.length > 0) {
            Raven.config(process.env.REACT_APP_SENTRY_SUBSCRIPTION_ID).install();
        }

        if (process.env.REACT_APP_MOBILE_ONLY === 'true') {
            if (!isMobile) {
                this.props.routerHistory.replace('/error/mobileonly');
                document.body.classList.add('mobile-only');
                this.setState({isAcuantSdkLoaded: true});
            } else {
                if (!this.props.config) {
                    this.props.routerHistory.replace('/');
                }
                this.loadScript();
            }
        } else {
            if (!this.props.config) {
                this.props.routerHistory.replace('/');
            }
            this.loadScript();
        }
    }

    loadScript() {
        const sdk = document.createElement("script");
        sdk.src = "AcuantJavascriptWebSdk.min.js";
        sdk.onload = () => window.loadAcuantSdk();
        window.onAcuantSdkLoaded = () => this.initialize();
        document.body.appendChild(sdk);

        const camera = document.createElement("script");
        camera.src = "AcuantCamera.min.js";
        document.body.appendChild(camera);

        const passiveLiveness = document.createElement("script");
        passiveLiveness.src = "AcuantPassiveLiveness.min.js";
        document.body.appendChild(passiveLiveness);
    }

    componentDidCatch(error, errorInfo) {
        if (process.env.REACT_APP_SENTRY_SUBSCRIPTION_ID && process.env.REACT_APP_SENTRY_SUBSCRIPTION_ID.length > 0) {
            Raven.captureException(error, {extra: errorInfo});
        }
        this.props.routerHistory.push('/error/default');
    }

    initialize() {
        if (!this.isInitialized && !this.isIntializing) {
            this.isIntializing = true;

            window.AcuantJavascriptWebSdk.initialize(
                (function() {
                    if (process.env.NODE_ENV === 'development') {
                        return btoa(`${process.env.REACT_APP_USER_NAME}:${process.env.REACT_APP_PASSWORD}`);
                    } else {
                        return process.env.REACT_APP_AUTH_TOKEN;
                    }
                })(), 
                process.env.REACT_APP_ACAS_ENDPOINT,
                {
                    onSuccess: function() {
                        if (!this.isOldiOS()) {
                            window.AcuantJavascriptWebSdk.startWorkers(this.initDone.bind(this));
                        } else {
                            window.AcuantJavascriptWebSdk.startWorkers(this.initDone.bind(this), [window.AcuantJavascriptWebSdk.ACUANT_IMAGE_WORKER]);
                        }
                    }.bind(this),

                    onFail: function() {
                        this.isIntializing = false;
                        this.setState({
                            isAcuantSdkLoaded: true
                        })
                    }.bind(this)
                });
        } 
    }

    isOldiOS() {
        let ua = navigator.userAgent;
        let keyPhrase = "iPhone OS";
        const keyPhrase2 = "iPad; CPU OS";
        let index = ua.indexOf(keyPhrase);
        if (index < 0) {
            keyPhrase = keyPhrase2;
            index = ua.indexOf(keyPhrase);
        }
        if (index >= 0) {
            let version = ua.substring(index + keyPhrase.length + 1, index + keyPhrase.length + 3);
            try {
                let versionNum = parseInt(version);
                if (versionNum && versionNum < 13) {
                    return true;
                } else {
                    return false;
                }
            } catch (_) {
                return false;
            }
        } else {
            return false;
        }
    }

    initDone() {
        this.isInitialized = true;
        this.isIntializing = false;
        this.setState({
            isAcuantSdkLoaded: true
        })
        console.log("initialize succeded");
    }

    render() {
        if (!localStorage.getItem('acuantEula') && this.props.routerHistory.location.pathname !== "/eula") {
            this.props.routerHistory.push("/eula");
        } 
        
        return (
            <div className={'mainContent'}>
                {
                    this.state.isAcuantSdkLoaded && <Provider store={this.props.store}>
                    <PersistGate loading={null} persistor={this.props.persistor}>
                        <ConnectedRouter history={this.props.routerHistory}>
                            <Switch>
                                <Redirect exact from="/" to="/capture/photo"/>
                                <Route path='/eula' exact component={EulaPage}/>
                                <Route path="/capture/photo" exact component={CapturePhoto}/>
                                <Route path="/capture/camera" exact component={AcuantReactCamera}/>
                                <Route path="/photo/confirm" exact component={ProcessedImageResult} />
                                <Route path="/capture/selfie" exact component={CaptureSelfie}/>
                                <Route path='/results' component={Results}/>
                                <Route path="/error" component={Error}/>
                            </Switch>
                        </ConnectedRouter>
                    </PersistGate>
                </Provider>
                }
            </div>
        );
    }
}

export default App;
