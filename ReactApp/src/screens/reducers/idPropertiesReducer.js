export function idPropertiesReducer(state = {}, action) {
    switch (action.type) {
        case "@@acuant/SET_ID_TYPE":
            return {
                ...state,
                cardType: action.data
            };
        case "@@acuant/SET_ORIENTATION":
            return {
                ...state,
                orientation: action.data
            };
        case "@@acuant/DECREMENT_SIDE": {
            let sidesLeft = state.sidesLeft;
            return {
                ...state,
                sidesLeft: sidesLeft - 1
            }
        }
        case "@@acuant/INCREMENT_SIDE": {
            let sidesLeft = state.sidesLeft;
            return {
                ...state,
                sidesLeft: sidesLeft + 1
            }
        }
        case "@@acuant/RESET_ID": {
            return {
                cardType: 0,
                orientation: 0,
                sidesLeft: 2
            }
        }
        default:
            return state;
    }
}