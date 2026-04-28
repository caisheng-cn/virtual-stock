const axios = require('axios')

global.mockAxiosGet = jest.fn()

global.cleanMocks = () => {
  global.mockAxiosGet.mockReset()
}

global.setupAxiosMocks = () => {
  jest.spyOn(axios, 'get').mockImplementation((url, config) => {
    return Promise.resolve({
      data: { mock: true },
      status: 200
    })
  })
}

global.restoreAxiosMocks = () => {
  jest.restoreAllMocks()
}