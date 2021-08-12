import ApiService from "../../services/api/api";

export function setInstanceID(payload) {
    return (dispatch) => {
        ApiService.getDocInstance()
            .then(data => {
                return dispatch({
                    type: "@@acuant/SET_INSTANCE_ID",
                    data
                })
            })
            .catch(err => {
                console.log("ApiService.setInstanceID:", err)
                throw new Error(err);
            })

    };
}

export function resetConfig() {
    return {
        type: "@@acuant/RESET_CONFIG"
    }
}

export function submitFrontID() {
    return {
        type: '@@acuant/FRONT_ID_SUBMITTED'
    }
}

export function submitBackID() {
    return {
        type: '@@acuant/BACK_ID_SUBMITTED'
    }
}