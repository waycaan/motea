import { api } from 'libs/server/connect';

export default api()
    .post(async (req, res) => {
        req.session.destroy();
        res.json({ success: true });
    });
