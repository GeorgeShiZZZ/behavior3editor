import * as ReactDOM from "react-dom";
import SyncRequest from "sync-request";
import React, { Component } from "react";
import { Layout, message, Tabs } from "antd";
import * as Utils from "../common/Utils";
import MainEventType from "../common/MainEventType";
import Settings from "../main-process/Settings";
import { ipcRenderer } from "electron";
import "antd/dist/antd.dark.css";
import "./index.css";
import RegisterNode from "./RegisterNode";
import TreeTabs from "./TreeTabs";
import Explorer from "./Explorer";
import BatchExec from "../common/BatchExec";

const { Sider, Content } = Layout;

interface MainState {
    workdir: string;
    workspace: string;
}

export default class Main extends Component {
    state: MainState = {
        workdir: "",
        workspace: "",
    };

    settings: Settings;
    tabs: TreeTabs;
    explorer: Explorer;
    session = 0;

    componentDidMount() {
        this.updateSettings();
        RegisterNode(this.settings);

        ipcRenderer.on(MainEventType.OPEN_FILE, (event: any, path: any) => {
            this.setState({ curPath: path });
        });

        ipcRenderer.on(MainEventType.OPEN_DIR, (event: any, workdir: any, workspace: string) => {
            console.log("on open workspace", workspace);
            document.title = workspace;
            this.setState({ workdir, workspace });
        });

        ipcRenderer.on(MainEventType.RELOAD_SERVER, () => {
            const serverModel = this.settings.serverModel;
            if (!serverModel) {
                message.warning("没有配置服务器");
                return;
            }
            SyncRequest("POST", serverModel.host, {
                body: JSON.stringify({
                    cmd: "btree.reload",
                    data: {
                        trees: this.tabs.getOpenTreesModel(),
                    },
                    session: this.session++,
                    timestamp: Date.now(),
                }),
            });
            message.success("服务器已更新");
        });

        ipcRenderer.on(MainEventType.BATCH_EXEC, (event: any, path: string) => {
            BatchExec(path, this.state.workdir);
        });

        console.log("workdir", this.settings.curWorkspace.getWorkdir());
        setTimeout(() => {
            this.setState({
                workdir: this.settings.curWorkspace.getWorkdir(),
                workspace: this.settings.curWorkspace.getFilepath(),
            });
        }, 50);

        this.setReSizer();
    }

    setReSizer() {
        let startX: number;
        let startWidth: number;

        const sider: any = document.getElementsByClassName("sider")[0];
        const reSizerParent: any = document.getElementsByClassName("ant-layout-sider-children")[0];
        const reSizer: any = document.getElementById("sizer-hint-bar");
        const content: any = document.getElementsByClassName("ant-layout-content content")[0];

        function initDrag(e: DragEvent) {
            startX = e.clientX;
            startWidth = parseInt(document.defaultView.getComputedStyle(reSizerParent).width, 10);
            document.documentElement.addEventListener("mousemove", doDrag, false);
            document.documentElement.addEventListener("mouseup", stopDrag, false);
        }

        function doDrag(e: DragEvent) {
            const calcWidth = startWidth + e.clientX - startX;
            setWidth(calcWidth);
        }

        function setWidth(width: number) {
            const maxValue = window.innerWidth * 0.8;
            const minValue = 100;
            if (width > maxValue) {
                width = maxValue;
            } else if (width < minValue) {
                width = minValue;
            }
            reSizerParent.style.width = width + "px";
            sider.style.width = width + "px";
            sider.style.maxWidth = width + "px";
            sider.style.minWidth = "0px";
            sider.style.flex = "";
            reSizer.style.left = width - 5 + "px";
            content.style.width = window.innerWidth - width + "px";
        }

        function stopDrag(e: DragEvent) {
            document.documentElement.removeEventListener("mousemove", doDrag, false);
            document.documentElement.removeEventListener("mouseup", stopDrag, false);
        }

        reSizer.addEventListener(
            "mouseover",
            function () {
                reSizer.style.opacity = "1";
                reSizer.addEventListener("mousedown", initDrag, false);
                reSizer.addEventListener(
                    "mouseout",
                    function init() {
                        reSizer.style.opacity = "0";
                    },
                    false
                );
            },
            false
        );

        window.addEventListener("resize", function () {
            const currentWidth = parseInt(
                document.defaultView.getComputedStyle(reSizerParent).width,
                10
            );
            setWidth(currentWidth);
        });

        setWidth(250);
    }

    updateSettings() {
        this.settings = Utils.getRemoteSettings();
    }

    render() {
        console.log("render main");
        const { workdir, workspace } = this.state;
        document.title = `行为树编辑器 - ${workspace}`;
        return (
            <Layout className="body" style={{ flexDirection: "column" }}>
                <Sider className="sider" width={250}>
                    {workdir !== "" ? (
                        <Explorer
                            ref={(ref) => {
                                this.explorer = ref;
                            }}
                            workdir={workdir}
                            onOpenTree={(path) => {
                                this.tabs.openFile(path);
                            }}
                            onDeleteTree={(path) => {
                                this.tabs.closeFile(path);
                            }}
                        />
                    ) : (
                        "Please Open Workspace"
                    )}
                </Sider>
                <div id="sizer-hint-bar" />
                <Content className="content">
                    <TreeTabs
                        ref={(ref) => {
                            this.tabs = ref;
                        }}
                        onTabSelected={(path) => {
                            this.explorer.selectNode(path);
                        }}
                    />
                </Content>
            </Layout>
        );
    }
}

ReactDOM.render(<Main />, document.getElementById("root") as HTMLElement);
