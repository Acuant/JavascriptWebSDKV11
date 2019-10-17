import React, {Component, Fragment} from 'react';
import {bindActionCreators} from "redux";
import {connect} from "react-redux";
import {Route} from "react-router-dom";
import DefaultError from "./DefaultError";
import LowResolution from "./LowResolution";
import Header from "../Header";
import MobileOnly from "./MobileOnly";

class Error extends Component {

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <Fragment>
                <Header />
                <Route path={`${this.props.match.url}/default`} component={DefaultError}/>
                <Route path={`${this.props.match.url}/lowresolution`} component={LowResolution}/>
                <Route path={`${this.props.match.url}/mobileonly`} component={MobileOnly}/>
            </Fragment>
        )
    }

}

function mapStateToProps(state) {
    return state;
}

function mapDispatchToProps(dispatch) {
    return bindActionCreators({}, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(Error);