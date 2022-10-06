Cypress.Commands.add('setupDatabase', () => {
  cy.log('setupDatabase not functional')
})

Cypress.Commands.add('login', (account, name) => {
  cy.visit('http://kf.kobo.local/accounts/login/')
  cy.get('input[name="username"]').type(name)
  cy.get('input[name="password"]').type(account.password)
  cy.contains('Login').click()
})

// Makes this case insensitive by default
Cypress.Commands.overwrite('contains',
  (originalFn, subject, filter, text, options = {}) => {
    // determine if a filter argument was passed
    if (typeof text === 'object') {
      options = text
      text = filter
      filter = undefined
    }

    options.matchCase ??= false

    return originalFn(subject, filter, text, options)
  }
)
