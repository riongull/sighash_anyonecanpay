import Dash from 'dash'
import Vue from 'vue'
// import localforage from 'localforage'

const Dashcore = require('@dashevo/dashcore-lib')
const Unit = Dashcore.Unit

const timeFunction = async (promiseToTime) => {
  const timingStart = Date.now()

  const promiseResult = await promiseToTime

  const timing = (Date.now() - timingStart) / 1000

  console.log(promiseResult, ` finished in ${timing}:>> `)

  return promiseResult
}

console.log('process.env:>> ', process.env)

let client, clientInitFinished

const getInitState = () => {
  return {
    snackbar: { show: false, color: 'red', text: '', timestamp: 0, link: null },
    dppCache: {},
    identityId: null,
    walletBalance: -1,
  }
}
export const state = () => getInitState()

export const getters = {
  getIdentityId(state) {
    return state.identityId
  },
  getSumPledges: (state) => (campaignId) => {
    console.log(campaignId)
    console.log('state.dppCache[campaignId] :>> ', state.dppCache[campaignId])
    const dppCache = Object.entries(state.dppCache)

    let sum = 0

    for (let idx = 0; idx < dppCache.length; idx++) {
      const element = dppCache[idx][1]
      // console.log('element', element)

      if (element.$type === 'pledge' && element.campaignId === campaignId)
        sum += JSON.parse(Buffer.from(element.utxo, 'base64').toString()).output
          .satoshis
    }

    return sum
  },
  getDocumentById: (state) => (docId) => {
    if (!docId)
      // TODO replace check with regexp
      throw new Error(
        `getDocumentById: Cannot get a document with docId: ${docId}`
      )
    return state.dppCache[docId]
  },
  getCampaignPledges: (state) => (campaignId) => {
    const dppCache = Object.entries(state.dppCache)

    const pledges = []

    for (let idx = 0; idx < dppCache.length; idx++) {
      const pledge = { ...dppCache[idx][1] }

      if (pledge.$type === 'pledge' && pledge.campaignId === campaignId) {
        pledge.utxo = JSON.parse(Buffer.from(pledge.utxo, 'base64').toString())

        pledges.push(pledge)
      }
    }
    console.log('pledges :>> ', pledges)
    return pledges
  },
}

export const mutations = {
  setWalletBalance(state, balance) {
    state.walletBalance = balance
  },
  setIdentityId(state, identityId) {
    state.identityId = identityId
  },
  setSnackBar(state, { text, color = 'red', link = null }) {
    state.snackbar.text = text
    state.snackbar.color = color
    state.snackbar.link = link
    state.snackbar.show = true
    state.snackbar.timestamp = Date.now()
  },
  setDppCache(state, { typeLocator, documents }) {
    // const [app, docType] = typeLocator.split('.')

    console.log('setting cache documents :>> ', documents)

    for (let i = 0; i < documents.length; i++) {
      const document = documents[i]

      console.log('document :>> ', document)

      Vue.set(state.dppCache, `${document.$id}`, document)
    }
  },
}

export const actions = {
  refreshBalance({ commit, state }) {
    const balance =
      client && client.account
        ? Unit.fromSatoshis(client.account.getTotalBalance()).toBTC()
        : -1

    if (balance !== state.walletBalance) commit('setWalletBalance', balance)
  },
  showSnackbar({ commit }, snackbar) {
    commit('setSnackBar', snackbar)
  },
  async isClientReady() {
    // eslint-disable-next-line no-unmodified-loop-condition
    while (!clientInitFinished) {
      console.log('client not ready')
      await this.$sleep(250)
    }
    return true
  },
  async isAccountReady() {
    // eslint-disable-next-line no-unmodified-loop-condition
    while (!clientInitFinished) {
      console.log('client not ready')
      await this.$sleep(250)
    }

    while (!client.wallet) {
      console.log('client init without mnemonic, please log in')
      await this.$sleep(250)
    }

    client.account = await client.wallet.getAccount({ index: 0 })
  },
  async initWallet({ state, commit }, { mnemonic }) {
    clientInitFinished = false

    commit('setIdentityId', null)

    console.log('Initializing Dash.Client with mnemonic: ', mnemonic)

    let clientOpts = {
      passFakeAssetLockProofForTests: process.env.LOCALNODE,
      dapiAddresses: process.env.DAPIADDRESSES,
      wallet: typeof mnemonic !== 'undefined' ? { mnemonic } : undefined,
    }

    // Remove undefined keys
    clientOpts = JSON.parse(JSON.stringify(clientOpts))

    // if (clientOpts.wallet) clientOpts.wallet.adapter = localforage

    console.dir({ clientOpts }, { depth: 100 })

    if (client) timeFunction(client.disconnect())

    client = new Dash.Client(clientOpts)

    console.log('client.wallet :>> ', client.wallet)

    Object.entries(client.getApps().apps).forEach(([name, entry]) =>
      console.log(name, entry.contractId.toString())
    )

    if (client.wallet) {
      client.account = await timeFunction(client.wallet.getAccount())

      console.log(
        'init Funding address',
        client.account.getUnusedAddress().address
      )
      console.log('init total Balance', client.account.getTotalBalance())

      // An account without identity can't submit documents, so let's create one
      if (!client.account.getIdentityIds().length) {
        const start = Date.now()
        const identity = await client.platform.identities.register()
        const timing = Math.floor(start - Date.now() / 1000)
        console.log(`identity registered in ${timing}:>> `, identity)
      }

      commit('setIdentityId', client.account.getIdentityIds()[0].toString())
    } else {
      console.log(
        'Initialized client without a wallet, you can fetch documents but not create documents, identities or names !!'
      )
    }
    clientInitFinished = true
  },
  async submitDocument({ dispatch, commit }, { typeLocator, doc }) {
    console.log(`submitDocument to ${typeLocator}`, doc)

    await dispatch('isAccountReady')

    const { platform } = client

    try {
      const identityId = client.account.getIdentityIds()[0]

      const getStart = Date.now()

      const identity = await platform.identities.get(identityId)

      console.log(
        'Get identity finished in: ',
        (Date.now() - getStart) / 1000,
        identity
      )

      // Create the document
      const document = await platform.documents.create(
        typeLocator,
        identity,
        doc
      )

      console.log('created document :>> ', document)

      const documentBatch = {
        create: [document],
        replace: [],
        delete: [],
      }

      const result = await platform.documents.broadcast(documentBatch, identity)

      console.log(`submitDocument result: ${typeLocator} :>> `, result)

      commit('setDppCache', { typeLocator, documents: result.transitions })

      return result
    } catch (e) {
      dispatch('showSnackbar', { text: e.message })
      console.error('Something went wrong:', e)
    }
  },
  async fetchDocumentById({ dispatch, commit }, { typeLocator, docId }) {
    const queryOpts = {
      limit: 1,
      startAt: 1,
      where: [['$id', '==', docId]],
    }

    console.log(
      `fetchDocumentById ${typeLocator}`,
      client.getApps().get(typeLocator.split('.')[0]).contractId.toString(),
      queryOpts
    )

    await dispatch('isClientReady')

    try {
      const [result] = await client.platform.documents.get(
        `${typeLocator}`,
        queryOpts
      )

      const document = result.toJSON()

      console.log(
        `fetched DocumentById ${typeLocator}`,
        { queryOpts },
        document
      )
      commit('setDppCache', { typeLocator, documents: [document] })
      return document
    } catch (e) {
      console.error(
        'Something went wrong:',
        'fetchDocuments()',
        {
          typeLocator,
          queryOpts,
        },
        e
      )
      dispatch('showSnackbar', { text: e, color: 'red' })
    }
  },
  async fetchDocuments(
    { dispatch, commit },
    {
      typeLocator,
      queryOpts = {
        limit: 1,
        startAt: 1,
      },
    }
  ) {
    console.log(
      `fetchDocuments ${typeLocator}`,
      client.getApps().get(typeLocator.split('.')[0]).contractId.toString(),
      queryOpts
    )

    await dispatch('isClientReady')

    try {
      const result = await client.platform.documents.get(
        `${typeLocator}`,
        queryOpts
      )

      const documents = result.map((el) => el.toJSON())

      console.log(`fetched Documents ${typeLocator}`, { queryOpts }, documents)
      commit('setDppCache', { typeLocator, documents })
      return documents
    } catch (e) {
      console.error(
        'Something went wrong:',
        'fetchDocuments()',
        {
          typeLocator,
          queryOpts,
        },
        e
      )
      dispatch('showSnackbar', { text: e, color: 'red' })
    }
  },
  async createPledgeUtxo(
    { state, dispatch, commit },
    { campaignSatoshis, pledgeSatoshis, campaignRecipient }
  ) {
    await dispatch('isAccountReady')
    const pledgeFromAddress = client.account.getUnusedAddress('internal') // TODO use special derivation path

    console.log(
      'createPledgeUtxo transaction, pledgeFromAddress',
      pledgeFromAddress
    )

    const transaction = client.account.createTransaction({
      recipients: [
        {
          recipient: pledgeFromAddress.address,
          satoshis: parseInt(pledgeSatoshis),
        },
      ],
    })

    console.log('prepare transaction:')
    console.dir(transaction.outputs[0])
    console.dir(transaction.outputs[0]._script)
    console.dir(transaction.outputs[0]._satoshis)
    // const pledgeUtxo = transaction.outputs[0];

    // console.log('input script:');
    // console.dir(transaction.inputs[0]._script);
    console.log('Broadcasting pledgeUtxo txs:')
    const transactionId = await client.account.broadcastTransaction(transaction)

    const pledgeUtxo = {
      txId: transactionId,
      outputIndex: 0,
      address: pledgeFromAddress.address,
      script: transaction.outputs[0]._script,
      satoshis: transaction.outputs[0]._satoshis,
    }

    console.log('pledgeUtxo :>> ', pledgeUtxo)
    console.log(
      'Pledge UTXO transaction successfully broadcast:',
      '\nWallet:',
      client.wallet.exportWallet(),
      '\ntxId:',
      transactionId,
      '\nfromAddress:',
      pledgeFromAddress.address
    )

    const privateKey = client.account.getPrivateKeys([
      pledgeFromAddress.address,
    ])[0].privateKey

    const tx = new Dashcore.Transaction()
      .from([pledgeUtxo]) // Feed information about what unspent outputs one can use
      .to(campaignRecipient, parseInt(campaignSatoshis)) // Add an output with the given amount of satoshis
      .sign([privateKey], 0x81) // Signs all the inputs it can

    /// START ASSEMBLE
    // const tx2hex =
    //   '7b2268617368223a2266393166313837633061623637323462326466666365613432323233393266626165393666633763366635356663373732316664356539306639633438366639222c2276657273696f6e223a332c22696e70757473223a5b7b227072657654784964223a2235346234666538636437386465316135313366343464326231303633343636333035306464366132393739376666653362303837303737616630623066386239222c226f7574707574496e646578223a302c2273657175656e63654e756d626572223a343239343936373239352c22736372697074223a2234383330343530323231303064613961313933633665393133666266623739396365303936383033316636306663393136616466383132653661306364633736656435373234333039343331303232303630313530656332333863333534643232666461666531353361633262613666386136356331663565616330313432386566633038336162343663616535313838313231303238653462303063636239393332306565626539376665336165626236333235643265303832656237643738623765373534376662343137316233653363326236222c22736372697074537472696e67223a223732203078333034353032323130306461396131393363366539313366626662373939636530393638303331663630666339313661646638313265366130636463373665643537323433303934333130323230363031353065633233386333353464323266646166653135336163326261366638613635633166356561633031343238656663303833616234366361653531383831203333203078303238653462303063636239393332306565626539376665336165626236333235643265303832656237643738623765373534376662343137316233653363326236222c226f7574707574223a7b227361746f73686973223a313030383030302c22736372697074223a223736613931346138393738303939356361383532666463633863653436343638333332393030306362623734313638386163227d7d5d2c226f757470757473223a5b7b227361746f73686973223a323030303030302c22736372697074223a223736613931343234376631366634653936666437303538366135623434303263646637633835343264303466326138386163227d5d2c226e4c6f636b54696d65223a307d'
    // const tx2Json = JSON.parse(Buffer.from(tx2hex, 'hex'))

    // const newTx2 = new Dashcore.Transaction(tx2Json)

    // console.log('newTx2 :>> ', newTx2)

    // tx.addInput(newTx2.inputs[0])
    // console.log(
    //   'tx with added input :>> ',
    //   tx,
    //   Buffer.from(JSON.stringify(tx.toJSON())).toString('hex')
    // )

    // const txBroadcast = await client.account.broadcastTransaction(tx)
    // console.log('txBroadcast :>> ', txBroadcast)

    /// END ASSEMBLE

    console.log(
      'tx :>> ',
      tx,
      Buffer.from(JSON.stringify(tx.toJSON())).toString('hex')
    )

    console.log('Created and signed input :>> ', tx.inputs[0])
    console.log(
      'JSON.stringify(tx.inputs[0]) :>> ',
      JSON.stringify(tx.inputs[0])
    )
    return [
      Buffer.from(JSON.stringify(tx.inputs[0].toJSON())).toString('base64'),
      Buffer.from(JSON.stringify(tx.toJSON())).toString('hex'),
    ]
  },
}
