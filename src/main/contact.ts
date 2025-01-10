import * as sql from '$main/sql'
import { Contact } from '$common/types'
import { handle, emit } from '$main/ipc'

handle('contact:all', () => {
  return sql.query.all('CONTACT_ALL', [])
})

handle('contact:upsert', async (contact: Contact) => {
  sql.query.run('CONTACT_UPSERT', [contact])
  emit('contacts', sql.query.all('CONTACT_ALL', []))
})

handle('contact:updateOne', (contact: Contact, name: string, note: string | null) => {
  sql.query.run('CONTACT_UPDATE_ONE', [{ address: contact.address, name, note }])
  return sql.query.get('CONTACT_GET', [{ address: contact.address }])
})

handle('contact:remove', async (contact: Contact) => {
  sql.query.run('CONTACT_REMOVE', [{ address: contact.address }])
  emit('contacts', sql.query.all('CONTACT_ALL', []))
})
