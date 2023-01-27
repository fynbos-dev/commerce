import cn from 'clsx'
import Link from 'next/link'
import { FC, useState } from 'react'
import s from './CartSidebarView.module.css'
import CartItem from '../CartItem'
import { Button, Input, Text } from '@components/ui'
import { useUI } from '@components/ui/context'
import { Bag, Cross, Check } from '@components/icons'
import useCart from '@framework/cart/use-cart'
import usePrice from '@framework/product/use-price'
import SidebarLayout from '@components/common/SidebarLayout'
import base64url from 'base64url'
import { getResponseToJSON } from '@github/webauthn-json/extended'

const CartSidebarView: FC = () => {
  const [ success, setSuccess ] = useState(false)
  const [ error, setError ] = useState(false)
  const [ paymentPointer, setPaymentPointer ] = useState<string>('')
  const { closeSidebar } = useUI()
  const { data, isLoading, isEmpty } = useCart()

  const { price: subTotal } = usePrice(
    data && {
      amount: Number(data.subtotalPrice),
      currencyCode: data.currency.code,
    }
  )
  const { price: total } = usePrice(
    data && {
      amount: Number(data.totalPrice),
      currencyCode: data.currency.code,
    }
  )

  const handleClose = () => {
    setSuccess(false)
    setError(false)
    closeSidebar()
  }

  const goToCheckout = async () => {
    if (!paymentPointer) return

    const start = await fetch('/api/payment/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerPaymentPointer: paymentPointer,
        amount: data!.totalPrice.toString(),
      }),
    }).then(async (res) => {
      if (!res.ok) { 
        setError(true)
        throw alert(await res.text())
      }
      return res.json()
    })

    const paymentResponse = await authorize({
      credentialIds: start.outgoingPaymentGrantContinue.interact.spc.credential_ids,
      challenge: start.outgoingPaymentGrantContinue.interact.spc.challenge,
      amount: data!.totalPrice.toString(),
      instrument: paymentPointer,
    }).catch((err) => {
      setError(true)
      throw alert(err)
    })

    const finish = await fetch('/api/payment/finish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        credential: getResponseToJSON(paymentResponse.details),
        ...start,
      }),
    }).then(async (res) => {
      if (!res.ok) {
        setError(true)
        await paymentResponse.complete('fail')
        throw alert(await res.text())
      }
      return res.json()
    })

    setSuccess(true)
    localStorage.removeItem('cartId')
    return paymentResponse.complete('success')
  }

  return (
    <SidebarLayout
      className={cn({
        [s.empty]: error || success || isLoading || isEmpty,
      })}
      handleClose={handleClose}
    >
      {isLoading || isEmpty ? (
        <div className="flex-1 px-4 flex flex-col justify-center items-center">
          <span className="border border-dashed border-primary rounded-full flex items-center justify-center w-16 h-16 p-12 bg-secondary text-secondary">
            <Bag className="absolute" />
          </span>
          <h2 className="pt-6 text-2xl font-bold tracking-wide text-center">
            Your cart is empty
          </h2>
          <p className="text-accent-3 px-10 text-center pt-2">
            Biscuit oat cake wafer icing ice cream tiramisu pudding cupcake.
          </p>
        </div>
      ) : error ? (
        <div className="flex-1 px-4 flex flex-col justify-center items-center">
          <span className="border border-white rounded-full flex items-center justify-center w-16 h-16">
            <Cross width={24} height={24} />
          </span>
          <h2 className="pt-6 text-xl font-light text-center">
            We couldn’t process the purchase. Please check your card information
            and try again.
          </h2>
        </div>
      ) : success ? (
        <div className="flex-1 px-4 flex flex-col justify-center items-center">
          <span className="border border-white rounded-full flex items-center justify-center w-16 h-16">
            <Check />
          </span>
          <h2 className="pt-6 text-xl font-light text-center">
            Thank you for your order.
          </h2>
        </div>
      ) : (
        <>
          <div className="px-4 sm:px-6 flex-1">
            <Link href="/cart">
              <Text variant="sectionHeading" onClick={handleClose}>
                My Cart
              </Text>
            </Link>
            <ul className={s.lineItemsList}>
              {data!.lineItems.map((item: any) => (
                <CartItem
                  key={item.id}
                  item={item}
                  currencyCode={data!.currency.code}
                />
              ))}
            </ul>
          </div>

          <div className="justify-between py-6 px-6">
            <li className="flex py-2">
              <span className="text-sm font-bold">Payment Pointer</span>
            </li>
            <Input
              placeholder="$fynbos.me/username"
              onChange={setPaymentPointer}
            />
          </div>
          <div className="flex-shrink-0 px-6 py-6 sm:px-6 sticky z-20 bottom-0 w-full right-0 left-0 bg-accent-0 border-t text-sm">
            <ul className="pb-2">
              <li className="flex justify-between py-1">
                <span>Subtotal</span>
                <span>{subTotal}</span>
              </li>
              <li className="flex justify-between py-1">
                <span>Taxes</span>
                <span>Calculated at checkout</span>
              </li>
              <li className="flex justify-between py-1">
                <span>Shipping</span>
                <span className="font-bold tracking-wide">FREE</span>
              </li>
            </ul>
            <div className="flex justify-between border-t border-accent-2 py-3 font-bold mb-2">
              <span>Total</span>
              <span>{total}</span>
            </div>
            <div>
              {process.env.COMMERCE_CUSTOMCHECKOUT_ENABLED ? (
                <Button Component="a" width="100%" onClick={goToCheckout}>
                  Proceed to Checkout ({total})
                </Button>
              ) : (
                <Button href="/checkout" Component="a" width="100%">
                  Proceed to Checkout
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </SidebarLayout>
  )
}

export default CartSidebarView

interface AuthorizeOptions {
  credentialIds: string[]
  challenge: string
  instrument: string
  amount: string
}

const authorize = async (opts: AuthorizeOptions) => {
  const request = new PaymentRequest(
    [
      {
        // Specify `secure-payment-confirmation` as payment method.
        supportedMethods: 'secure-payment-confirmation',
        data: {
          rpId: 'localhost',
          // List of credential IDs obtained from the RP server.
          credentialIds: [base64url.toBuffer(opts.credentialIds[0])],
          // The challenge is also obtained from the RP server.
          challenge: base64url.toBuffer(opts.challenge),
          // A display name and an icon that represent the payment instrument.
          instrument: {
            displayName: opts.instrument,
            icon: 'https://fynbos.app/icon.png',
            iconMustBeShown: false,
          },
          // The origin of the payee (merchant)
          payeeOrigin: 'https://acme.commerce',
          // The number of milliseconds to timeout.
          timeout: 360000, // 6 minutes
        },
      },
    ],
    {
      // Payment details.
      total: {
        label: 'Total',
        amount: {
          currency: 'USD',
          value: opts.amount,
        },
      },
    }
  )

  try {
    const response = await request.show().catch((err) => {
      console.log(err)
    })
    if (!response) {
      // The user cancelled the payment.
      throw new Error('Payment cancelled')
    }
    // response.details is a PublicKeyCredential, with a clientDataJSON that
    // contains the transaction data for verification by the issuing bank.
    // Make sure to serialize the binary part of the credential before
    // transferring to the server.
    return response
  } catch (err) {
    // SPC cannot be used; merchant should fallback to traditional flows
    throw err
  }
}
