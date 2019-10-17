export function setCardType(payload) {
    return {
        type: "@@acuant/SET_ID_TYPE",
        data: payload
    }
}

export function setCardOrientation(payload) {
    return {
        type: "@@acuant/SET_ORIENTATION",
        data: payload
    }
}

export function decrementSidesLeft() {
    return {
        type: "@@acuant/DECREMENT_SIDE"
    }
}

export function incrementSidesLeft() {
    return {
        type: "@@acuant/INCREMENT_SIDE"
    }
}

export function resetIDProperties() {
    return {
        type: "@@acuant/RESET_ID"
    }
}