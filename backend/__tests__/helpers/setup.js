jest.setTimeout(10000)

afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 100))
})