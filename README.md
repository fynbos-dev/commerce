# GNAP SPC Interaction Demo

## Requirements
- Docker
- A running forked Rafiki Local Development Environment (https://github.com/fynbos-dev/rafiki)
- A device that supports Secure Payment Confirmation
- NodeJS v16

## Quick Setup
```
mkdir gnap-spc-demo
git clone https://github.com/fynbos-dev/rafiki.git
cd rafiki
pnpm i
pnpm localenv up -d --build
cd ..
git clone https://github.com/fynbos-dev/commerce.git
cd commerce
cp ./site/.env.template ./site/.env.local
pnpm i
pnpm dev
```
After the setup: 

- open http://localhost:3030 and update credential for the account you want to use in the demo.

You can start using demo http://localhost:3003 and check balances for demo accounts at http://localhost:3030 and http://localhost:3031. You can use `$fynbos/accounts/gfranklin` in the checkout (she has $4000 balance so it's more than enough.).