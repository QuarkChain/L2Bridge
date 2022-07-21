<template>
  <div id="app">
    <el-container>
      <el-header class="header">
        <Header/>
      </el-header>

      <el-main :style="'min-height:'+ (fullHeight-159) +'px;'">
        <router-view :key="$route.fullPath"/>
      </el-main>

      <el-footer class="footer">
        <div class="footer-layout">
          <el-row>
            <img class="footer-img" src="frontendnew/src/assets/git.png"/>
            <img class="footer-img" src="frontendnew/src/assets/tweet.png"/>
            <img class="footer-img" src="frontendnew/src/assets/mid.png"/>
            <img class="footer-img" src="frontendnew/src/assets/tel.png"/>
            <img class="footer-img" src="frontendnew/src/assets/dis.png"/>
          </el-row>
        </div>
      </el-footer>
    </el-container>
  </div>
</template>

<script>
import Header from "./components/Header";

export default {
  name: 'App',
  components: {
    Header
  },
  data() {
    return {
      fullHeight: document.documentElement.clientHeight
    }
  },
  watch: {
    fullHeight(val) {
      if (!this.timer) {
        this.fullHeight = val;
        this.timer = true;
        let that = this;
        setTimeout(function () {
          that.timer = false;
        }, 400)
      }

    }
  },
  mounted() {
    this.get_bodyHeight()
  },
  methods: {
    get_bodyHeight() {
      const that = this
      window.onresize = () => {
        return (() => {
          window.fullHeight = document.documentElement.clientHeight;
          that.fullHeight = window.fullHeight;
        })()
      }
    }
  }
}
</script>

<style>
#app {
  max-width: 1200px;
  text-align: center;
  font-family: Avenir, Helvetica, Arial, AlibabaPuHuiTiM, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  margin: 0 auto;
}

.header {
  height: 64px !important;
  padding: 5px 20px !important;
}

.footer {
  padding: 30px !important;
  height: 95px !important;
  background: transparent;
}

.footer-layout {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.footer-img {
  width: 36px;
  margin: 0 10px;
}

@media screen and (max-width: 420px) {
  .footer-img {
    width: 28px;
  }
}
</style>
