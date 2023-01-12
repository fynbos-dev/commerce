import { Cart, CartItemBody } from "@vercel/commerce/types/cart"
import data from '../data.json'

export const createCart = () => {
	const cart = {
		id: crypto.randomUUID(),
		createdAt: '',
		currency: { code: 'USD' },
		taxesIncluded: true,
		lineItems: [],
		lineItemsSubtotalPrice: 0,
		subtotalPrice: 0,
		totalPrice: 0,
	} as Cart

	localStorage.setItem('cart-' + cart.id, JSON.stringify(cart))
	localStorage.setItem('cartId', cart.id)

	return cart
}

export const getCart = (): Cart => {
	const cartId = localStorage.getItem('cartId') 
	if (!cartId) {
		return createCart()
	}

	const cart = localStorage.getItem('cart-' + cartId)
	if (!cart) {
		return createCart()
	}

	return JSON.parse(cart) as Cart
}

export const updateCart = (newCart: Cart) => {
	newCart.lineItemsSubtotalPrice = calculateTotal(newCart)
	newCart.subtotalPrice = calculateTotal(newCart)
	newCart.totalPrice = calculateTotal(newCart)

	localStorage.setItem('cart-' + newCart.id, JSON.stringify(newCart))

	return newCart
}

export const createItem = (itemBody: CartItemBody) => {
	const product = data.products.find((product) => product.id === itemBody.productId)!
	const variant = product.variants.find((variant) => variant.id === itemBody.variantId)!

	const cart = getCart()

	// increase quantity if the item already exists
	if (cart.lineItems.some((item) => item.variantId === itemBody.variantId)) {
		const item = cart.lineItems.find((item) => item.variantId === itemBody.variantId)!
		item.quantity++
		return updateCart(cart)
	}

	const item = {
		id: crypto.randomUUID(),
    name: product.name,
    variantId: itemBody.variantId,
    productId: product.id,
    quantity: 1,
    path: product.path!,
    discounts: [],
    variant: {
      id: variant.id,
      name: product.name,
      price: product.price.value,
      listPrice: product.price.value,
      image: {
        url: product.images[0].url,
      },
    }
	}

	cart.lineItems.push(item)
	return updateCart(cart)
}

export const removeItem = (itemId: string) => {
	const cart = getCart()
	cart.lineItems = cart.lineItems.filter((item) => item.id !== itemId)
	return updateCart(cart)
}

export const updateItem = (itemId: string, item: CartItemBody) => {
	const cart = getCart()
	const cartItem = cart.lineItems.find((item) => item.id === itemId)!
	cartItem.quantity = item.quantity!
	return updateCart(cart)
}

export const calculateTotal = (cart: Cart) => {
  return cart.lineItems.reduce((total, item) => {
    return total + item.variant.price * item.quantity
  }, 0)
}
