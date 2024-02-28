import { Entity, Column, OneToMany, AfterLoad, ManyToOne, Unique } from 'typeorm';
import { StatusBase } from './base/statusBase';
import { Membership } from './membershipsEntity';
import { App } from './appsEntity';

enum Gender {
	Male = 'male',
	Female = 'female'
}
@Entity('users')
@Unique(['app', 'username'])
@Unique(['app', 'email'])
export class User extends StatusBase {
	@Column({ nullable: false })
	username: string;

	@Column({ nullable: false })
	email: string;

	@Column({ nullable: false })
	password: string;

	@Column()
	firstName: string;

	@Column()
	lastName: string;

	@Column()
	middleName: string;

	fullName: string;
	@AfterLoad()
	setName() {
		this.fullName = `${this.firstName} ${this.middleName + ' '}${this.lastName}`;
	}

	@Column()
	recovery1Q: string;

	@Column()
	recovery1A: string;

	@Column()
	recovery2Q: string;

	@Column()
	recovery2A: string;

	@Column()
	recovery3Q: string;

	@Column()
	recovery3A: string;

	@Column()
	photo: string;

	@Column({ type: 'date' })
	birthday: string;

	@Column({ type: 'enum', enum: Gender })
	gender: Gender;

	@OneToMany(() => Membership, membership => membership.user)
	membership: Membership[];

	@ManyToOne(() => App, app => app.users)
	app: App;
}
