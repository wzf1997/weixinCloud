const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const axios = require("axios");
const multer = require("multer");

const fs = require("fs");

const FormData = require("form-data");

const logger = morgan("tiny");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(logger);

const upload = multer({ dest: "uploads/" }); // 配置上传临时目录

// 配置微信参数
const WECHAT_CONFIG = {
  appid: process.env.WECHAT_APPID, // 建议使用环境变量
  secret: process.env.WECHAT_SECRET,
};

// 首页
app.get("/", async (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 小程序调用，获取微信 Open ID
app.get("/api/wx_openid", async (req, res) => {
  if (req.headers["x-wx-source"]) {
    res.send(req.headers["x-wx-openid"]);
  }
});

// 获取微信access_token
app.get("/api/wx/token", async (req, res) => {
  try {
    const response = await axios.get(
      "https://api.weixin.qq.com/cgi-bin/token",
      {
        params: {
          grant_type: "client_credential",
          appid: WECHAT_CONFIG.appid,
          secret: WECHAT_CONFIG.secret,
        },
      }
    );

    res.send({
      code: 200,
      data: response.data,
    });
  } catch (error) {
    res.status(500).send({
      code: -1,
      error: error.message,
    });
  }
});

app.get("/api/wx/datacube", async (req, res) => {
  try {
    const response = await axios.post(
      `https://api.weixin.qq.com/datacube/getarticlesummary`,
      {
        begin_date: "2025-04-01",
        end_date: "2025-04-24",
      }
    );
    res.send(response.data);
  } catch (error) {
    res.status(500).send({
      code: -1,
      error: error.message,
    });
  }
});

// 上传图片到微信公众号素材箱
app.post("/api/wx/uploadimg", upload.single("media"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({
        code: -1,
        error: "请上传文件",
      });
    }

    console.log(req.file);

    const formData = new FormData();

    formData.append("media", fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    console.log(formData);

    const response = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/media/uploadimg`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          "Content-Type": "multipart/form-data",
        },
      }
    );

    // 删除临时文件
    fs.unlinkSync(req.file.path);

    res.send({
      code: 0,
      data: response.data,
    });
  } catch (error) {
    // 确保清理临时文件
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).send({
      code: -1,
      error: error.message,
    });
  }
});

// 上传图片到微信公众号素材箱
app.post("/api/wx/addMaterial", upload.single("media"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({
        code: -1,
        error: "请上传文件",
      });
    }

    const formData = new FormData();

    formData.append("media", fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const response = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/material/add_material?type=image`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          "Content-Type": "multipart/form-data",
        },
      }
    );

    // 删除临时文件
    fs.unlinkSync(req.file.path);

    res.send({
      code: 0,
      data: response.data,
    });
  } catch (error) {
    // 确保清理临时文件
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).send({
      code: -1,
      error: error.message,
    });
  }
});

// 删除素材
app.get("/api/wx/delMaterial", async (req, res) => {
  const media_id = req.query.media_id;

  const response = await axios.post(
    `https://api.weixin.qq.com/cgi-bin/material/del_material`,

    {
      media_id: media_id,
    }
  );
  res.send(response.data);
});

// 获取素材列表
app.get("/api/wx/getMaterial", async (req, res) => {
  try {
    const type = req.query.type || "image";
    const offset = req.query.offset || 0;
    const count = req.query.count || 20;

    const response = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/material/batchget_material`,
      {
        type: type,
        offset: offset,
        count: count,
      }
    );
    res.send(response.data);
  } catch (error) {
    res.status(500).send({
      code: -1,
      error: error.message,
    });
  }
});

// 新建草稿
app.post("/api/wx/draft/add", async (req, res) => {
  try {
    const { articles } = req.body;

    articles.forEach((article) => {
      article.content = JSON.parse(JSON.stringify(article.content));
    });

    const response = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/draft/add`,
      {
        articles,
      }
    );
    res.send({
      code: 0,
      data: response.data,
    });
  } catch (error) {
    res.status(500).send({
      code: -1,
      error: error.message,
    });
  }
});

// 获取草稿
app.get("/api/wx/draft/get", async (req, res) => {
  try {
    const { media_id } = req.query;
    const response = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/draft/get`,
      {
        media_id,
      }
    );
    res.send({
      code: 0,
      data: response.data,
    });
  } catch (error) {
    res.status(500).send({
      code: -1,
      error: error.message,
    });
  }
});

// 删除草稿
app.post("/api/wx/draft/delete", async (req, res) => {
  try {
    const { media_id } = req.body;
    const response = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/draft/delete`,
      {
        media_id,
      }
    );
    res.send({
      code: 0,
      data: response.data,
    });
  } catch (error) {
    res.status(500).send({
      code: -1,
      error: error.message,
    });
  }
});

// 获取草稿总数
app.get("/api/wx/draft/count", async (req, res) => {
  try {
    const response = await axios.get(
      `https://api.weixin.qq.com/cgi-bin/draft/count`
    );
    res.send({
      code: 0,
      data: response.data,
    });
  } catch (error) {
    res.status(500).send({
      code: -1,
      error: error.message,
    });
  }
});

// 获取草稿列表
app.get("/api/wx/draft/batchget", async (req, res) => {
  try {
    const { offset = 0, count = 20, no_content = 0 } = req.query;
    const response = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/draft/batchget`,
      {
        offset: parseInt(offset),
        count: parseInt(count),
        no_content: parseInt(no_content),
      }
    );
    res.send({
      code: 0,
      data: response.data,
    });
  } catch (error) {
    res.status(500).send({
      code: -1,
      error: error.message,
    });
  }
});

// 发布草稿
app.post("/api/wx/draft/publish", async (req, res) => {
  try {
    const { media_id } = req.body;
    const response = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/freepublish/submit`,
      {
        media_id,
      }
    );
    res.send({
      code: 0,
      data: response.data,
    });
  } catch (error) {
    res.status(500).send({
      code: -1,
      error: error.message,
    });
  }
});

const port = process.env.PORT || 80;

async function bootstrap() {
  // await initDB();
  app.listen(port, () => {
    console.log("启动成功", port);
  });
}

bootstrap();
