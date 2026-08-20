// 导入自己需要的组件
import {
    Form,
    FormItem,
    Dialog,
    Row,
    Col,
    Button,
    ButtonGroup,
    Table,
    TableColumn,
    Input,
    InputNumber,
    Message,
    MessageBox,
    Container,
    Header,
    Main,
    Drawer,
    Empty,
    RadioGroup,
    RadioButton,
    Upload,
    Dropdown,
    DropdownMenu,
    DropdownItem,
    Tabs,
    TabPane,
    Divider,
    Tooltip
} from 'element-ui'
const element = {
    install: function (Vue) {
        Vue.use(Input)
        Vue.use(InputNumber)
        Vue.use(Dialog)
        Vue.use(Drawer)
        Vue.use(Empty)
        Vue.use(RadioGroup)
        Vue.use(RadioButton)
        Vue.use(Row)
        Vue.use(Col)
        Vue.use(Form)
        Vue.use(FormItem)
        Vue.use(Button)
        Vue.use(ButtonGroup)
        Vue.use(Table)
        Vue.use(TableColumn)
        Vue.use(Container)
        Vue.use(Header)
        Vue.use(Main)
        Vue.use(Upload)
        Vue.use(Dropdown)
        Vue.use(DropdownItem)
        Vue.use(DropdownMenu)
        Vue.use(Tabs)
        Vue.use(TabPane)
        Vue.use(Divider)
        Vue.use(Tooltip)
        Vue.prototype.$message = Message
        Vue.prototype.$confirm = MessageBox.confirm
    }
}
export default element
