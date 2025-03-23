import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Form, Modal, Input, Select, DatePicker, message, Spin, Typography, Tabs, Tag, Space, Statistic, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, DollarOutlined, FileExcelOutlined, BarChartOutlined } from '@ant-design/icons';
import moment from 'moment';
import adminService from '../../services/admin.service';
import organizationService from '../../services/organization.service';
import './BillingManagement.css';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;
const { RangePicker } = DatePicker;

const BillingManagement = () => {
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [billingPeriods, setBillingPeriods] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [form] = Form.useForm();
  const [dateRange, setDateRange] = useState([moment().startOf('month'), moment().endOf('month')]);
  const [tab, setTab] = useState('invoices');
  
  // 請求額集計
  const [billingStats, setBillingStats] = useState({
    totalBilled: 0,
    pendingAmount: 0,
    paidAmount: 0,
    overdue: 0
  });

  useEffect(() => {
    fetchOrganizations();
    fetchBillingPeriods();
    fetchInvoices();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const response = await organizationService.getAllOrganizations();
      setOrganizations(response.data);
      setLoading(false);
    } catch (error) {
      message.error('組織情報の取得に失敗しました');
      setLoading(false);
    }
  };

  const fetchBillingPeriods = async () => {
    try {
      setLoading(true);
      // 実際のAPIが実装されるまでのダミーデータ
      const periods = [
        { id: '1', name: '2025年3月', startDate: '2025-03-01', endDate: '2025-03-31' },
        { id: '2', name: '2025年2月', startDate: '2025-02-01', endDate: '2025-02-29' },
        { id: '3', name: '2025年1月', startDate: '2025-01-01', endDate: '2025-01-31' }
      ];
      setBillingPeriods(periods);
      setLoading(false);
    } catch (error) {
      message.error('請求期間の取得に失敗しました');
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      // 実際のAPIが実装されるまでのダミーデータ
      const dummyInvoices = [
        {
          id: '1',
          invoiceNumber: 'INV-2025-001',
          organizationId: organizations[0]?.id || 'org1',
          organizationName: organizations[0]?.name || 'テスト組織1',
          amount: 145000,
          currency: 'JPY',
          status: 'paid',
          issuedDate: '2025-03-01',
          dueDate: '2025-03-15',
          paidDate: '2025-03-10',
          items: [
            { description: 'Claude API使用料', quantity: 1, unitPrice: 100000, amount: 100000 },
            { description: 'Pro Plan サブスクリプション', quantity: 5, unitPrice: 9000, amount: 45000 }
          ]
        },
        {
          id: '2',
          invoiceNumber: 'INV-2025-002',
          organizationId: organizations[1]?.id || 'org2',
          organizationName: organizations[1]?.name || 'テスト組織2',
          amount: 75000,
          currency: 'JPY',
          status: 'pending',
          issuedDate: '2025-03-01',
          dueDate: '2025-03-15',
          items: [
            { description: 'Claude API使用料', quantity: 1, unitPrice: 75000, amount: 75000 }
          ]
        },
        {
          id: '3',
          invoiceNumber: 'INV-2025-003',
          organizationId: organizations[0]?.id || 'org1',
          organizationName: organizations[0]?.name || 'テスト組織1',
          amount: 120000,
          currency: 'JPY',
          status: 'overdue',
          issuedDate: '2025-02-01',
          dueDate: '2025-02-15',
          items: [
            { description: 'Claude API使用料', quantity: 1, unitPrice: 120000, amount: 120000 }
          ]
        }
      ];
      
      setInvoices(dummyInvoices);
      
      // 統計情報の計算
      const stats = {
        totalBilled: 0,
        pendingAmount: 0,
        paidAmount: 0,
        overdue: 0
      };
      
      dummyInvoices.forEach(invoice => {
        stats.totalBilled += invoice.amount;
        if (invoice.status === 'pending') {
          stats.pendingAmount += invoice.amount;
        } else if (invoice.status === 'paid') {
          stats.paidAmount += invoice.amount;
        } else if (invoice.status === 'overdue') {
          stats.overdue += invoice.amount;
        }
      });
      
      setBillingStats(stats);
      setLoading(false);
    } catch (error) {
      message.error('請求情報の取得に失敗しました');
      setLoading(false);
    }
  };

  const handleCreateInvoice = () => {
    setCurrentInvoice(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEditInvoice = (invoice) => {
    setCurrentInvoice(invoice);
    form.setFieldsValue({
      organizationId: invoice.organizationId,
      amount: invoice.amount,
      dueDate: moment(invoice.dueDate),
      status: invoice.status
    });
    setIsModalVisible(true);
  };

  const handleModalOk = () => {
    form.validateFields()
      .then(values => {
        if (currentInvoice) {
          // 請求書更新ロジック（APIが実装されたら置き換え）
          const updatedInvoices = invoices.map(inv => 
            inv.id === currentInvoice.id ? {
              ...inv,
              organizationId: values.organizationId,
              organizationName: organizations.find(org => org.id === values.organizationId)?.name || '',
              amount: values.amount,
              dueDate: values.dueDate.format('YYYY-MM-DD'),
              status: values.status
            } : inv
          );
          setInvoices(updatedInvoices);
          message.success('請求書が更新されました');
        } else {
          // 新規請求書作成ロジック（APIが実装されたら置き換え）
          const newInvoice = {
            id: `temp-${Date.now()}`,
            invoiceNumber: `INV-${Date.now()}`,
            organizationId: values.organizationId,
            organizationName: organizations.find(org => org.id === values.organizationId)?.name || '',
            amount: values.amount,
            currency: 'JPY',
            status: values.status,
            issuedDate: moment().format('YYYY-MM-DD'),
            dueDate: values.dueDate.format('YYYY-MM-DD'),
            items: [
              { description: 'Claude API使用料', quantity: 1, unitPrice: values.amount, amount: values.amount }
            ]
          };
          setInvoices([...invoices, newInvoice]);
          message.success('新しい請求書が作成されました');
        }
        setIsModalVisible(false);
      })
      .catch(info => {
        console.log('Validate Failed:', info);
      });
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
  };

  const handleDeleteInvoice = (invoiceId) => {
    Modal.confirm({
      title: '請求書を削除しますか？',
      content: 'この操作は元に戻せません。',
      okText: '削除',
      okType: 'danger',
      cancelText: 'キャンセル',
      onOk() {
        // 請求書削除ロジック（APIが実装されたら置き換え）
        const updatedInvoices = invoices.filter(inv => inv.id !== invoiceId);
        setInvoices(updatedInvoices);
        message.success('請求書が削除されました');
      }
    });
  };

  const handleDownloadInvoice = (invoice) => {
    message.info(`請求書 ${invoice.invoiceNumber} のダウンロードが開始されました`);
    // ダウンロードロジック（実際のAPIが実装されたら置き換え）
  };

  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
    // 日付範囲に基づいて請求書をフィルタリング（実際のAPIが実装されたら置き換え）
  };

  const handleExportInvoices = () => {
    message.info('請求書一覧のエクスポートが開始されました');
    // エクスポートロジック（実際のAPIが実装されたら置き換え）
  };

  const getStatusTag = (status) => {
    if (status === 'paid') {
      return <Tag color="green">支払済</Tag>;
    } else if (status === 'pending') {
      return <Tag color="orange">未払い</Tag>;
    } else if (status === 'overdue') {
      return <Tag color="red">期限超過</Tag>;
    }
    return <Tag>不明</Tag>;
  };

  const columns = [
    {
      title: '請求書番号',
      dataIndex: 'invoiceNumber',
      key: 'invoiceNumber',
    },
    {
      title: '組織名',
      dataIndex: 'organizationName',
      key: 'organizationName',
    },
    {
      title: '金額',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount, record) => `${amount.toLocaleString()} ${record.currency}`,
    },
    {
      title: '発行日',
      dataIndex: 'issuedDate',
      key: 'issuedDate',
    },
    {
      title: '支払期限',
      dataIndex: 'dueDate',
      key: 'dueDate',
    },
    {
      title: '支払日',
      dataIndex: 'paidDate',
      key: 'paidDate',
      render: (paidDate) => paidDate || '-',
    },
    {
      title: 'ステータス',
      dataIndex: 'status',
      key: 'status',
      render: (status) => getStatusTag(status),
    },
    {
      title: 'アクション',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditInvoice(record)}
          />
          <Button
            type="link"
            icon={<DeleteOutlined />}
            danger
            onClick={() => handleDeleteInvoice(record.id)}
          />
          <Button
            type="link"
            icon={<DownloadOutlined />}
            onClick={() => handleDownloadInvoice(record)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div className="billing-management-container">
      <Card className="billing-header">
        <Title level={2}>請求管理</Title>
        <Text>組織別の請求と支払いを管理します</Text>
      </Card>

      <div className="billing-stats">
        <Card>
          <div className="stats-grid">
            <Statistic 
              title="請求総額"
              value={billingStats.totalBilled}
              prefix={<DollarOutlined />}
              suffix="円"
            />
            <Statistic 
              title="支払済金額" 
              value={billingStats.paidAmount} 
              valueStyle={{ color: '#3f8600' }} 
              suffix="円"
            />
            <Statistic 
              title="未払い金額" 
              value={billingStats.pendingAmount} 
              valueStyle={{ color: '#faad14' }}
              suffix="円" 
            />
            <Statistic 
              title="期限超過金額" 
              value={billingStats.overdue} 
              valueStyle={{ color: '#cf1322' }}
              suffix="円" 
            />
          </div>
        </Card>
      </div>

      <Card className="billing-content">
        <Tabs defaultActiveKey="invoices" onChange={setTab}>
          <TabPane tab="請求書" key="invoices">
            <div className="table-actions">
              <div className="left-actions">
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />} 
                  onClick={handleCreateInvoice}
                >
                  新規請求書作成
                </Button>
                <Button 
                  icon={<FileExcelOutlined />} 
                  onClick={handleExportInvoices}
                >
                  エクスポート
                </Button>
              </div>
              <div className="right-actions">
                <RangePicker 
                  value={dateRange} 
                  onChange={handleDateRangeChange}
                  format="YYYY-MM-DD"
                />
              </div>
            </div>
            
            <Alert
              message="注意"
              description="このコンポーネントはプレビューであり、バックエンドAPIは実装中です。実際のデータは表示されていません。"
              type="warning"
              showIcon
              className="preview-alert"
            />

            <Table 
              dataSource={invoices} 
              columns={columns} 
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          <TabPane tab="使用量レポート" key="reports">
            <div className="report-container">
              <Alert
                message="機能準備中"
                description="使用量レポート機能は現在開発中です。次回のアップデートでリリース予定です。"
                type="info"
                showIcon
              />
              
              <div className="placeholder-chart">
                <BarChartOutlined />
                <p>使用量グラフがここに表示されます</p>
              </div>
            </div>
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title={currentInvoice ? "請求書の編集" : "新規請求書の作成"}
        visible={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        okText={currentInvoice ? "更新" : "作成"}
        cancelText="キャンセル"
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="organizationId"
            label="組織"
            rules={[{ required: true, message: '組織を選択してください' }]}
          >
            <Select placeholder="組織を選択">
              {organizations.map(org => (
                <Option key={org.id} value={org.id}>{org.name}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="amount"
            label="金額 (JPY)"
            rules={[
              { required: true, message: '金額を入力してください' },
              { type: 'number', min: 0, message: '有効な金額を入力してください' }
            ]}
          >
            <Input type="number" suffix="円" />
          </Form.Item>
          
          <Form.Item
            name="dueDate"
            label="支払期限"
            rules={[{ required: true, message: '支払期限を選択してください' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="status"
            label="ステータス"
            rules={[{ required: true, message: 'ステータスを選択してください' }]}
            initialValue="pending"
          >
            <Select>
              <Option value="pending">未払い</Option>
              <Option value="paid">支払済</Option>
              <Option value="overdue">期限超過</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BillingManagement;