'use strict';

module.exports = {
  name: '003-add-superadmin-role',

  async up({ sequelize }) {
    if (sequelize.getDialect() === 'postgres') {
      await sequelize.query("ALTER TYPE \"enum_users_role\" ADD VALUE IF NOT EXISTS 'superadmin'");
    }
    // Promote the existing administrator instead of relying on a seeded email.
    await sequelize.query(`
      UPDATE users
      SET role = 'superadmin'
      WHERE id = (
        SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1
      )
    `);
  },
};