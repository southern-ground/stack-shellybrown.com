/**
 * React Static Boilerplate
 * https://github.com/kriasoft/react-static-boilerplate
 *
 * Copyright © 2015-present Kriasoft, LLC. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {createStore} from 'redux';
import {
    TOGGLE_ITEM,
    SET_INVENTORY,
    UPDATE_INVENTORY,
    REMOVE_ITEM,
    GET_INVENTORY_RESPONSE, GET_INVENTORY_ERROR, GET_INVENTORY,
    GET_IMAGE_DATA_RESPONSE, GET_IMAGE_DATA_ERROR,
    GET_PRICE, GET_PRICE_RESPONSE,
    ADD_TO_CART, ADD_TO_CART_ERROR,
    CLEAR_ALL_ITEMS
} from '../core/action-types';
import {
    API_URL,
    BUBBLE_UP_API_URL,
    COOKIE_NAME,
    IMAGE_DATA_URL,
    SALE_PERCENTAGE
} from '../core/constants';
import _ from '../node_modules/lodash';
import request from 'superagent';
import Cookies from '../node_modules/js-cookie/src/js.cookie.js';
import history from './history';

const initialState = {
    inventory: [],
    stack: [],
    selectCount: 0
};

const store = createStore((state = initialState, action) => {

    console.log('ACTION:', action.type);

    switch (action.type) {

        case CLEAR_ALL_ITEMS:

            Cookies.set(COOKIE_NAME, {
                    selectedProducts: [],
                    action: action.type
                },
                {
                    expires: 7
                }
            );

            return {
                ...state, inventory: state.inventory.map((item)=> {
                    return {...item, selected: false}
                }), stack: [], enoughSelected: false
            };

        case ADD_TO_CART:

            var productSKUs = state.stack.map((item)=> {
                return item.sku;
            });

            request
                .get(BUBBLE_UP_API_URL + productSKUs.join(','))
                .withCredentials()
                .end((err, res) => {

                    if (err) {

                        // In the HIGHLY unlikely event of an error ...
                        console.warn('ADD_TO_CART Error:');
                        console.log(err);
                        store.dispatch({type: ADD_TO_CART_ERROR, err});

                    } else {

                        var response = JSON.parse(res.text);
                        window.location = response.url_cart;

                    }
                });

            return {...state, processingStoreRequest: true};

        case GET_PRICE:

            state.stack.map((item)=> {

                if (item.price == 0) {

                    // Is the item currently on sale?
                    var onSale = _.find(item.category_ids, item=> {
                        return item === "74";
                    });

                    request
                        .get('http://shellybrown.com/api.php?action=msrp&productID=' + item.product_id)
                        .end((err, res) => {

                            if (err) {
                                /*
                                 in case there is any error, dispatch an action containing the error
                                 */
                                console.warn('Price Retrieval Error:');
                                console.log(err);
                                store.dispatch({type: GET_INVENTORY_ERROR, err});

                            } else {

                                const data = JSON.parse(res.text);

                                /*
                                 Once data is received, dispatch an action telling the application 
                                 that data was received successfully, along with the parsed data 
                                 */

                                store.dispatch({type: GET_PRICE_RESPONSE, data});
                            }

                        });

                }
            });

            return state;

        case GET_PRICE_RESPONSE:

            var data = action.data.data,
                updateID = data.product_id,
                updatePrice = Number(data.price),
                newInventory,
                newStack;

            if (data.on_sale == 1) {
                updatePrice -= (updatePrice * (SALE_PERCENTAGE / 100));
            }

            newInventory = state.inventory.map((item)=> {
                if (item.product_id === updateID) {
                    item.price = updatePrice;
                }
                return item;
            });

            newStack = state.stack.map((item)=> {
                if (item.product_id === updateID) {
                    item.price = updatePrice;
                }
                return item;
            });

            return {...state, inventory: newInventory, stack: newStack};

        case GET_IMAGE_DATA_RESPONSE:
            // Retrieved the image data; now get the actual inventory:
            request
                .get(API_URL)
                .end((err, res) => {
                    if (err) {
                        /*
                         in case there is any error, dispatch an action containing the error
                         */
                        console.warn('GET_INVENTORY Error:');
                        console.log(err);
                        store.dispatch({type: GET_INVENTORY_ERROR, err});
                    } else {
                        const data = JSON.parse(res.text);
                        /*
                         Once data is received, dispatch an action telling the application
                         that data was received successfully, along with the parsed data
                         */
                        store.dispatch({type: GET_INVENTORY_RESPONSE, data})
                    }
                });
            return {...state, imageData: action.data};
        case GET_INVENTORY:

            // Let's first get the JSON data of images.
            request
                .get(IMAGE_DATA_URL)
                .end((err, res) => {
                    if (err) {
                        console.warn('GET_INVENTORY Error:', err);
                        store.dispatch({type: GET_IMAGE_DATA_ERROR, err});
                    } else {
                        store.dispatch({type: GET_IMAGE_DATA_RESPONSE, data: JSON.parse(res.text).stackItems || []});
                    }
                });

            return state;

        case GET_INVENTORY_ERROR:

            console.warn('GET_INVENTORY_ERROR');

            return state;

        case GET_INVENTORY_RESPONSE:

            var newInventory = [],
                inventoryMissingImages = [],
                existingInventory = action.data.data,
                itemFound = false,
                i;

            // Grab any items that were previously checked.
            var cookie = Cookies.get(COOKIE_NAME) ? JSON.parse(Cookies.get(COOKIE_NAME)) : {},
                savedStack = cookie.selectedProducts || [];

            // Cycle over all the products we have images for looking for matches:
            existingInventory.map(item=> {

                itemFound = false;

                for (i = 0; i < state.imageData.length; i++) {

                    if (state.imageData[i].sku == item.sku) {
                        itemFound = true;
                        break;
                    }
                }

                if (itemFound) {

                    var itemDataWithImage = state.imageData[i];
                    itemDataWithImage.selected = _.find(savedStack, (stackItem)=> {
                        return item.product_id === stackItem.product_id;
                    });

                    newInventory.push(Object.assign({}, item, itemDataWithImage));

                } else {
                    inventoryMissingImages.push(Object.assign({}, item, state.imageData[i]));
                }

            });

            _.each(inventoryMissingImages, (item)=> {
                console.warn('Image missing for item #' + item.product_id, item.sku, item.name);
            });

            state = {
                ...state,
                inventory: newInventory,
                stack: savedStack,
                enoughSelected: savedStack.length >= 2,
                processingStoreRequest: false,
                urlCart: ''
            };

            if (savedStack.length > 0) {
                // Coming from a previous saved state
                // or social share; go to the arrange page

                history.push({pathname: "/arrange"});

                return state;


            } else {
                return state;
            }

        case SET_INVENTORY:

            return {...state, inventory: action.items};

        case TOGGLE_ITEM:

            var stack = [],
                newState = {
                    ...state,
                    inventory: state.inventory.map(item=> {
                        if (item.sku === action.sku) {
                            item.selected = !item.selected;
                        }
                        if (item.selected) {
                            stack.push(item);
                        }
                        return item;
                    }),
                    stack: stack
                };

            newState.inventory.map(item=> {
                if (item.sku === action.sku) {
                    item.stackOrder = newState.stack.length - 1;
                }
            });

            newState.stack.map(item=> {
                if (item.sku === action.sku) {
                    item.stackOrder = newState.stack.length - 1;
                }
            });

            newState.stack = _.sortBy(newState.stack, 'stackOrder');

            newState.enoughSelected = newState.stack.length >= 2;

            newState.processingStoreRequest = false;

            // Clear the reference to the cart if it previously existed.
            // This should re-set the Add to Cart Button.

            newState.urlCart = '';

            Cookies.set(COOKIE_NAME, {
                    selectedProducts: newState.stack.map(item=> {
                            return item
                        },
                    ),
                    action: action.type
                },
                {
                    expires: 7
                }
            );

            return newState;

        case
        UPDATE_INVENTORY:

            var newStack = action.items,
                newInventory = state.inventory.map(item=> {
                    _.each(newStack, newItem=> {
                        if (newItem.sku === item.sku) {
                            item.stackOrder = newItem.stackOrder;
                        }
                    });
                    return item;
                });

            return {
                ...state,
                inventory: newInventory,
                stack: newStack
            };

        case
        REMOVE_ITEM:

            var newStack = [],
                stackOrderOffset = -1,
                newInventory = state.inventory.map((item, index)=> {

                    if (item.sku === action.sku) {
                        item.selected = false;
                        if (item.stackOrder && item.stackOrder >= 0) {
                            stackOrderOffset = item.stackOrder;
                        }
                    }

                    if (item.selected) {
                        newStack.push(item);
                    }

                    return item;

                });

            newStack = _.sortBy(newStack, 'stackOrder');

            if (stackOrderOffset >= 0) {
                newStack.map((item, index)=> {
                    if (item.stackOrder >= stackOrderOffset) {
                        --item.stackOrder;
                    }
                });
            }

            return {
                ...state,
                inventory: newInventory,
                stack: newStack,
                enoughSelected: newStack.length >= 2
            };

        default:

            return state;

    }
});

export default store;
