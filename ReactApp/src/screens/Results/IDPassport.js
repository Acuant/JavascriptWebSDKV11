import React, {Component, Fragment} from 'react';
import {Redirect} from "react-router-dom";
import moment from "moment";
import {connect} from "react-redux";
import Processing from "./../Processing";
import {bindActionCreators} from "redux";
import {processID} from './../actions/processDataActions';
import {resetProcessedData} from "../actions/processDataActions";
import {resetConfig} from "../actions/configActions";
import {resetIDProperties} from "../actions/idPropertiesActions";
import Header from "../Header";

class IDPassport extends Component {
    constructor(props) {
        super(props);
        this.state = {
            loading: false,
            fields: {}
        }
    }

    componentDidMount() {
        if (process.env.REACT_APP_FRM_ENABLED === 'false') {
            let {instanceID} = this.props;
            this.props.processID(instanceID, true);
        }
    }

    processDate(date) {
        date = date.replace("Date", "");
        date = date.replace(")", "");
        date = date.replace("(", "");
        date = date.split("/").join("");
        date = date.split("+")[0];
        return parseInt(date);
    }

    resetStoreAndRedirect() {
        this.props.resetConfig();
        this.props.resetIDProperties();
        this.props.resetProcessedData();
        this.props.history.push('/');
    }

    appendIfNotEmpty(str){
        if(str && str.length > 0){
            return ", " + str
        }
        else{
            return ""
        }
    }

    render() {
        if (!this.props.resultData) {
            return <Processing/>
        }
        return (
            <Fragment>

                <Header/>

                {this.props.resultData &&

                <div className='body column results'>

                    <div className='wrapper'>

                        <div className='row results_id_sig'>

                            <figure className='results_id'>
                                {this.props.resultData['Photo'].length > 0 && <img alt='idscango' className={'profile'} src={this.props.resultData['Photo']}/>}
                            </figure>

                            <figure className='results_sig'>
                                {this.props.resultData['Signature'].length > 0 && <img alt='idscango' className={'signature'} src={this.props.resultData['Signature']}/>}
                            </figure>

                        </div>

                        <div className='results_data'>

                                {this.props.resultData['Full Name'] &&
                                <div className='row'>
                                    <div className='type'>Name</div>
                                    <div className='data'>{this.props.resultData['Full Name']}</div>
                                </div>
                                }
                                {this.props.resultData.Authentication &&
                                <div className='row'>
                                    <div className='type'>Document Authentication</div>
                                    <div className='data'>{this.props.resultData.Authentication}</div>
                                </div>
                                }
                                {this.props.liveness &&
                                  <div className='row'>
                                    <div className='type'>Liveness: </div>
                                    { 
                                        this.props.liveness.LivenessResult && 
                                        <div className='data'>{this.props.liveness.LivenessResult.LivenessAssessment}{this.appendIfNotEmpty(this.props.liveness.ErrorCode)}{this.appendIfNotEmpty(this.props.liveness.Error)}</div>
                                    }
                                    {
                                        (!this.props.liveness.LivenessResult) && 
                                        <div className='data'>{this.props.liveness.ErrorCode}{this.appendIfNotEmpty(this.props.liveness.Error)}</div>
                                    }
                                </div>
                                }
                                {this.props.faceMatch !== null &&
                                <div className='row'>
                                    <div className='type'>Facial Score</div>
                                    <div className='data'>{this.props.faceMatch}</div>
                                </div>
                                }
                                {this.props.resultData['Document Number'] &&
                                <div className='row'>
                                    <div className='type'>License No.</div>
                                    <div className='data'>{this.props.resultData['Document Number']}</div>
                                </div>
                                }
                                {this.props.resultData['Address'] &&
                                <div className='row'>
                                    <div className='type'>Address</div>
                                    <div className='data'>{this.props.resultData['Address'].replace(/[\u2028]/g,' ')}</div>
                                </div>
                                }
                                {this.props.resultData['Birth Date'] &&
                                <div className='row'>
                                    <div className='type'>Date of Birth</div>
                                    <div className='data'>
                                        {moment(this.processDate(this.props.resultData['Birth Date'])).utc().format("MM-DD-YYYY")}
                                    </div>
                                </div>
                                }
                                {this.props.resultData['Expiration Date'] &&
                                <div className='row'>
                                    <div className='type'>Expiration Date</div>
                                    <div className='data'>
                                        {moment(this.processDate(this.props.resultData['Expiration Date'])).utc().format("MM-DD-YYYY")}
                                    </div>
                                </div>
                                }
                                {this.props.resultData['Issue Date'] &&
                                <div className='row'>
                                    <div className='type'>Issue Date</div>
                                    <div className='data'>
                                        {moment(this.processDate(this.props.resultData['Issue Date'])).utc().format("MM-DD-YYYY")}
                                    </div>
                                </div>
                                }

                        </div>

                        <a className='btn outline' onClick={() => this.resetStoreAndRedirect()}>
                            <p className={'buttonBgText'}>Home</p>
                        </a>

                    </div>

                </div>

                }

            </Fragment>
        );
    }
}

function mapStateToProps(state) {
    return {
        instanceID: state.config.instanceID,
        faceMatch: state.processedData.faceMatch,
        liveness: state.processedData.liveness,
        resultData: state.processedData.result,
        cardType: state.idProperties.cardType
    }
}

function mapDispatchToProps(dispatch) {
    let actions = bindActionCreators({processID, resetProcessedData, resetConfig, resetIDProperties}, dispatch);
    return {...actions, dispatch};
}

export default connect(mapStateToProps, mapDispatchToProps)(IDPassport);