import React, {Component, Fragment} from 'react';
import {bindActionCreators} from "redux";
import {connect} from "react-redux";
import {Route} from "react-router-dom";
import Header from "../Header";
import IDPassport from "./IDPassport";
import MedicalCard from "./MedicalCard";

class Results extends Component {

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <Fragment>
                <Route path={`${this.props.match.url}/default`} component={IDPassport} />
                <Route path={`${this.props.match.url}/medicard`} component={MedicalCard} />
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

export default connect(mapStateToProps, mapDispatchToProps)(Results);