'use strict';

module.exports = {
  name: '004-promote-existing-admin',

  async up({ sequelize }) {
    await sequelize.query(`
      UPDATE users
      SET role = 'superadmin'
      WHERE id = (
        SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1
      )
    `);
  },
};
